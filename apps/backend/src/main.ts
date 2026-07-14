import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { useRequestLogging } from './utils/request-logging';
import { configureApp } from './bootstrap';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  // No `cors: true` here — CORS is configured exactly once, inside configureApp().
  // Enabling it in more than one place lets the last call silently win and reset
  // the origin allowlist to `*`.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
  });

  useRequestLogging(app);

  // Versioning, validation, the response envelope, the exception filter and CORS.
  // Shared with the integration tests, so what they exercise is what runs here.
  configureApp(app);

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
