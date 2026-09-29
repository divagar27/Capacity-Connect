import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/roles.decorator';
import { AllowPending } from '../../common/decorators/allow-pending.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Role, UserStatus } from '@capacity-connect/shared';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OnboardingDto {
  @IsEnum(Role)
  requestedRole: Role;

  @IsNotEmpty()
  @IsString()
  department: string;

  @IsNotEmpty()
  @IsString()
  designation: string;

  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  phone: string;
}

export class DemoSwitchDto {
  @IsIn([Role.ADMIN, Role.TRAINER, Role.TRAINEE])
  role: Role;
}

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth2 flow with PKCE redirect' })
  redirectToGoogle(
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Res() res: Response,
  ) {
    const url = this.authService.getGoogleAuthUrl(state, codeChallenge);
    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 callback: verifies ID token, assigns cookies, and redirects by user status' })
  async handleCallback(
    @Query('code') code: string,
    @Query('code_verifier') codeVerifier: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.handleGoogleCallback(code, codeVerifier);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (result.user.status === UserStatus.PENDING) {
      if (result.isNewUser || !result.user.requestedRole) {
        return res.redirect(`${frontendUrl}/onboarding`);
      }
      return res.redirect(`${frontendUrl}/pending-approval`);
    } else if (result.user.status === UserStatus.REJECTED) {
      return res.redirect(`${frontendUrl}/access-rejected`);
    } else if (result.user.status === UserStatus.DEACTIVATED) {
      return res.redirect(`${frontendUrl}/account-deactivated`);
    }

    return res.redirect(`${frontendUrl}/portal`);
  }

  @AllowPending()
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pending user: complete profile with requested role, department, designation, employee ID, and phone' })
  async onboarding(
    @CurrentUser() user: RequestUser,
    @Body() dto: OnboardingDto,
  ) {
    return this.authService.submitOnboarding(user.id, dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and detect reuse attack' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.['refreshToken'];
    const result = await this.authService.refreshSession(rawRefreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear auth cookies and blacklist token in Redis' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = req.cookies?.['accessToken'];
    const refreshToken = req.cookies?.['refreshToken'];

    await this.authService.logout(accessToken, refreshToken);
    this.clearAuthCookies(res);
    return { success: true, message: 'Logged out successfully' };
  }

  @Public()
  @Post('demo-switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Non-production: Switch demo persona (ADMIN, TRAINER, TRAINEE) for evaluation' })
  async demoSwitch(
    @Body() dto: DemoSwitchDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginDemoUser(dto.role || Role.TRAINEE);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { success: true, user: result.user };
  }
}
