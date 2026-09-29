import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { StandardErrorResponse } from '@capacity-connect/shared';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        code = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || exception.message;
        code = obj.error || exception.name;

        // Class-validator errors typically come as array in obj.message
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
          fieldErrors = {};
          obj.message.forEach((msg: string) => {
            const parts = msg.split(' ');
            const field = parts[0] || 'general';
            if (!fieldErrors![field]) fieldErrors![field] = [];
            fieldErrors![field].push(msg);
          });
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error at ${request.method} ${request.url}`, exception.stack);
      message = exception.message;
    }

    const errorPayload: StandardErrorResponse = {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorPayload);
  }
}
