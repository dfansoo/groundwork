import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Emits openapi.json — the contract @workspace/api-client generates its types from.
 *
 * This must run on a clean clone: in CI, and before anyone has created a .env,
 * generated signing keys, or started Postgres. Producing a *document* needs none
 * of those, so anything missing is stubbed here and the database connection is
 * skipped (see OPENAPI_ONLY in PrismaService).
 */
function stubEnvForDocumentGeneration(): void {
  process.env.OPENAPI_ONLY = '1';

  process.env.NODE_ENV ??= 'development';
  process.env.DATABASE_URL ??=
    'postgresql://localhost:5432/openapi-not-connected';
  process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32).toString('base64');

  const hasKeys =
    process.env.JWT_PRIVATE_KEY_PATH &&
    process.env.JWT_PUBLIC_KEY_PATH &&
    existsSync(process.env.JWT_PRIVATE_KEY_PATH) &&
    existsSync(process.env.JWT_PUBLIC_KEY_PATH);

  if (!hasKeys) {
    // AuthModule reads the keypair off disk at boot. Throwaway EC keys satisfy it;
    // they sign nothing, because nothing is served.
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const dir = mkdtempSync(join(tmpdir(), 'groundwork-openapi-'));
    const priv = join(dir, 'private.pem');
    const pub = join(dir, 'public.pem');
    writeFileSync(priv, privateKey);
    writeFileSync(pub, publicKey);
    process.env.JWT_PRIVATE_KEY_PATH = priv;
    process.env.JWT_PUBLIC_KEY_PATH = pub;
  }
}

async function generate() {
  stubEnvForDocumentGeneration();

  // Imported after the env is stubbed — the module graph reads config at import time.
  const { AppModule } = await import('../src/app.module');

  // abortOnError:false — Nest otherwise swallows a startup failure into a bare
  // process.exit(1), which with a quiet logger leaves no trace at all.
  const app = await NestFactory.create(AppModule, {
    logger: ['error'],
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
  // belongs at the package root, where api-client reads it.
  const out = join(process.cwd(), 'openapi.json');
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  console.log(`Wrote ${out} (${Object.keys(document.paths).length} paths)`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
