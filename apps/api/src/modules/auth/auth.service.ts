import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { NotificationService } from '../../common/services/notification.service';
import { Role, UserStatus } from '@capacity-connect/shared';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_CALLBACK_URL'),
    );
  }

  /**
   * Step 1: Generate Google OAuth redirect URL with state & PKCE code challenge
   */
  getGoogleAuthUrl(state?: string, codeChallenge?: string) {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ];

    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || crypto.randomBytes(16).toString('hex'),
      code_challenge: codeChallenge,
      code_challenge_method: codeChallenge ? ('S256' as any) : undefined,
    });
  }

  /**
   * Step 2: Verify Google Authorization code or ID token
   */
  async handleGoogleCallback(code: string, codeVerifier?: string, redirectUri?: string) {
    let payload: any;

    try {
      const { tokens } = await this.googleClient.getToken({
        code,
        codeVerifier,
        redirect_uri: redirectUri || this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      });

      if (!tokens.id_token) {
        throw new UnauthorizedException('No ID token received from Google');
      }

      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      payload = ticket.getPayload();
    } catch (err: any) {
      this.logger.error('Google token exchange failed', err.stack);
      throw new UnauthorizedException('Google OAuth authentication failed: ' + (err.message || 'invalid token'));
    }

    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid Google user identity');
    }

    const { sub: googleSub, email, name, picture, email_verified } = payload;
    if (!email_verified) {
      throw new UnauthorizedException('Google email address must be verified');
    }

    const adminEmails = (this.configService.get<string>('ADMIN_EMAILS') || '')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    const isBootstrapAdmin = adminEmails.includes(email.toLowerCase());

    // 1. Find user by google_sub
    let user = await this.prisma.user.findUnique({
      where: { googleSub },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          googleSub,
          email,
          name: name || 'IMD Official',
          avatarUrl: picture,
          role: isBootstrapAdmin ? Role.ADMIN : null,
          status: isBootstrapAdmin ? UserStatus.ACTIVE : UserStatus.PENDING,
          lastLoginAt: new Date(),
          authIdentities: {
            create: {
              provider: 'google',
              providerUserId: googleSub,
            },
          },
        },
      });

      // Alert admins about new pending user registration
      if (!isBootstrapAdmin) {
        await this.notificationService.notifyAdmins(
          'New Pending User Registration',
          `User ${name} (${email}) has registered and requires approval.`,
        );
      }
    } else {
      // Existing user update
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          avatarUrl: picture || user.avatarUrl,
          name: name || user.name,
          ...(isBootstrapAdmin && user.role !== Role.ADMIN
            ? { role: Role.ADMIN, status: UserStatus.ACTIVE }
            : {}),
        },
      });
    }

    const tokens = await this.generateSessionTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as unknown as Role,
      status: user.status as unknown as UserStatus,
    });

    return {
      ...tokens,
      user,
      isNewUser,
    };
  }

  /**
   * Pending user onboarding profile completion
   */
  async submitOnboarding(
    userId: string,
    dto: {
      requestedRole: Role;
      department: string;
      designation: string;
      employeeId: string;
      phone: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        requestedRole: dto.requestedRole,
        department: dto.department,
        designation: dto.designation,
        employeeId: dto.employeeId,
        phone: dto.phone,
      },
    });
  }

  /**
   * Token generation with hashed refresh token storage
   */
  async generateSessionTokens(user: { id: string; email: string; role?: Role; status: UserStatus; name: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Rotating refresh token with reuse attack detection
   */
  async refreshSession(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: if token is already revoked, potential token theft -> revoke ALL tokens for this user!
    if (tokenRecord.isRevoked) {
      this.logger.warn(`Token reuse detected for user ${tokenRecord.userId}. Invalidating all sessions!`);
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Token reuse detected. All sessions revoked for security.');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke this token on consumption (rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    return this.generateSessionTokens({
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      name: tokenRecord.user.name,
      role: tokenRecord.user.role as unknown as Role,
      status: tokenRecord.user.status as unknown as UserStatus,
    });
  }

  /**
   * Logout: blacklist access token in Redis and revoke refresh token in database
   */
  async logout(accessToken?: string, rawRefreshToken?: string) {
    if (accessToken) {
      // Blacklist token in Redis for 15 minutes
      await this.redisService.blacklistToken(accessToken, 900);
    }

    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out and session revoked successfully' };
  }

  /**
   * Safe Non-Production Demo Session Initiation (SIH Evaluator Demonstration Only)
   * Resolves or provisions standard demonstration actors in the configured PostgreSQL database:
   * ADMIN, TRAINER, TRAINEE without bypassing production credentials.
   */
  async loginDemoUser(targetRole: Role) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Demo accounts are strictly disabled in production mode');
    }

    if (![Role.ADMIN, Role.TRAINER, Role.TRAINEE].includes(targetRole)) {
      throw new BadRequestException('Choose a supported demo role');
    }

    const demoUsers: Partial<Record<Role, { email: string; name: string; dept: string; desig: string; empId: string }>> = {
      [Role.ADMIN]: {
        email: 'admin@demo.local',
        name: 'Meera Iyer (Demo admin)',
        dept: 'Sample Administration Unit',
        desig: 'Platform administrator',
        empId: 'DEMO-ADM-001',
      },
      [Role.TRAINER]: {
        email: 'trainer@demo.local',
        name: 'Nikhil Sen (Demo trainer)',
        dept: 'Sample Forecasting Division',
        desig: 'Training specialist',
        empId: 'DEMO-TRN-001',
      },
      [Role.TRAINEE]: {
        email: 'trainee@demo.local',
        name: 'Asha Raman (Demo trainee)',
        dept: 'Sample Regional Centre',
        desig: 'Meteorological officer',
        empId: 'DEMO-TRA-001',
      },
    };

    const profile = demoUsers[targetRole];
    if (!profile) throw new BadRequestException('Choose a supported demo role');

    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleSub: `capacity-connect-demo-${targetRole.toLowerCase()}`,
          email: profile.email,
          name: profile.name,
          role: targetRole,
          status: UserStatus.ACTIVE,
          department: profile.dept,
          designation: profile.desig,
          employeeId: profile.empId,
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          role: targetRole,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });
    }

    const tokens = await this.generateSessionTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      status: user.status as UserStatus,
    });

    return {
      ...tokens,
      user,
    };
  }
}
