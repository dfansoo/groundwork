import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { useRequestLogging } from './utils/request-logging';
import {
  ValidationPipe,
  HttpStatus,
  UnprocessableEntityException,
  VersioningType,
} from '@nestjs/common';
import { CustomExceptionFilter } from './utils/exception-filter';
import { ResponseInterceptor } from './utils/response.interceptor';
import helmet from 'helmet';
import compression = require('compression');
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  // No `cors: true` here — CORS is configured exactly once, further down. Enabling
  // it in more than one place lets the last call silently win and reset the origin
  // allowlist to `*`.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
  });

  useRequestLogging(app);
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const details = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
        }));
        return new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message: 'Validation failed',
          details,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new CustomExceptionFilter());

  app.use(helmet());
  app.use(compression());

  // The single source of CORS truth. An unset ALLOWED_ORIGINS denies cross-origin
  // requests rather than falling open to `*`.
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Groundwork API')
    .setDescription(
      'Fullstack boilerplate API — authentication, RBAC, file uploads, audit log, and transactional email.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('doc', app, SwaggerModule.createDocument(app, config));

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // Default 9000 matches Docker and prod. Windows reserves 8925-9024, so set PORT
  // in .env if the port is refused locally.
  await app.listen(Number(process.env.PORT) || 9000);
}

void bootstrap();
