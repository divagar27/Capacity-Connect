import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@capacity-connect/shared';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import { ALLOW_PENDING_KEY } from '../decorators/allow-pending.decorator';

@Injectable()
export class StatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthenticated requests
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException('Your account has been deactivated. Please contact IMD admin.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenException('Your registration was rejected by the administrator.');
    }

    if (user.status === UserStatus.PENDING && !allowPending) {
      throw new ForbiddenException('Your account is pending admin approval.');
    }

    return true;
  }
}
