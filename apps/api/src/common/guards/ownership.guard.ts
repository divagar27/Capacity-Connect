import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@capacity-connect/shared';

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // Admins bypass ownership check
    if (user.role === Role.ADMIN) return true;

    const resourceOwnerId = request.params?.userId || request.body?.userId || request.body?.trainerId;

    if (resourceOwnerId && resourceOwnerId !== user.id) {
      throw new ForbiddenException('Access denied: You do not own this resource');
    }

    return true;
  }
}
