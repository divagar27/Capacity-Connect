import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const port = process.env.PORT || 4000;
  const prefix = process.env.API_PREFIX || 'api/v1';

  // Security Headers
  app.use(helmet());

  // Cookie parser for reading httpOnly auth & refresh tokens
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix(prefix);

  // Enable CORS with credentials for cookies
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? [frontendUrl]
      : [frontendUrl, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Strict validation pipe for incoming request payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Capacity Connect API')
    .setDescription(
      'Capacity-building and learning management portal prototype for the India Meteorological Department and Ministry of Earth Sciences - SIH 26075',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  await app.listen(port);
  logger.log(`Capacity Connect API listening on port ${port} with prefix /${prefix}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/${prefix}/docs`);
}

bootstrap();
