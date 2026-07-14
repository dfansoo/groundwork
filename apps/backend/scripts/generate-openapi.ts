import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';

/**
 * Emits openapi.json — the contract @workspace/api-client generates types from.
 * Builds the Swagger document without listening on a port, so it is safe to run
 * as a Turbo task and in CI.
 */
async function generate() {
  // abortOnError:false — Nest otherwise swallows a startup failure into a silent
  // process.exit(1), which with logger:false leaves no trace at all.
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.enableVersioning({ type: VersioningType.URI });

  const config = new DocumentBuilder()
    .setTitle('Groundwork API')
    .setDescription(
      'Fullstack boilerplate API — authentication, RBAC, file uploads, audit log, and transactional email.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // cwd, not __dirname: this runs compiled from dist/scripts, and the contract
  // belongs at the package root where api-client reads it.
  const out = join(process.cwd(), 'openapi.json');
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  console.log(`Wrote ${out} (${Object.keys(document.paths).length} paths)`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
