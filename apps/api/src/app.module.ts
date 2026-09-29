import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/services/redis.module';
import { NotificationModule } from './common/services/notification.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LibraryModule } from './modules/library/library.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { CmsModule } from './modules/cms/cms.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CompetencyModule } from './modules/competency/competency.module';
import { AiModule } from './modules/ai/ai.module';
import { MediaModule } from './modules/media/media.module';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { StatusGuard } from './common/guards/status.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../infra/.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    NotificationModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    CoursesModule,
    LibraryModule,
    AssessmentsModule,
    CertificatesModule,
    FeedbackModule,
    CmsModule,
    AuditLogModule,
    ReportsModule,
    CompetencyModule,
    AiModule,
    MediaModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: StatusGuard,
    },
  ],
})
export class AppModule {}
