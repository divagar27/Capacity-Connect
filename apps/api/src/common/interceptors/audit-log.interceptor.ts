import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // We only audit state-changing mutations: POST, PUT, PATCH, DELETE
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const user = request.user;
      const url = request.url;
      const body = { ...request.body };

      // Redact sensitive keys if any
      delete body.password;
      delete body.codeVerifier;

      const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
      const userAgent = request.headers['user-agent'];

      return next.handle().pipe(
        tap(async () => {
          try {
            await this.prisma.auditLog.create({
              data: {
                userId: user?.id || null,
                action: `${method} ${url}`,
                resource: url.split('?')[0],
                details: { body, params: request.params, query: request.query },
                ipAddress: String(ipAddress),
                userAgent: String(userAgent || ''),
              },
            });
          } catch (e) {
            // Logging shouldn't crash request flow
          }
        })
      );
    }

    return next.handle();
  }
}
