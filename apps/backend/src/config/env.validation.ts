import * as Joi from 'joi';

/**
 * Cloud storage config is required only when FILES_DRIVER=s3, mirroring how
 * MAIL_TRANSPORT gates the Brevo key. This is what lets a fresh clone of the
 * template boot with nothing but Postgres.
 */
const whenS3 = (schema: Joi.StringSchema) =>
  Joi.string().when('FILES_DRIVER', {
    is: 's3',
    then: schema.required(),
    otherwise: Joi.string().allow('').optional(),
  });

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().optional().default(9000),

  JWT_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_PUBLIC_KEY_PATH: Joi.string().required(),
  AUTH_EXCHANGE_SECRET: Joi.string()
    .optional()
    .default('local-auth-exchange-secret-please-change'),
  ACCESS_TOKEN_TTL: Joi.string().optional().default('15m'),
  REFRESH_TOKEN_TTL: Joi.string().optional().default('30d'),
  ALLOWED_ORIGINS: Joi.string()
    .optional()
    .default('http://localhost:3000,http://localhost:3001'),

  DATABASE_URL: Joi.string().required(),
  DATA_ENCRYPTION_KEY: Joi.string().required(),

  // `local` writes uploads to disk under LOCAL_STORAGE_DIR and needs no cloud account.
  FILES_DRIVER: Joi.string().valid('local', 's3').optional().default('local'),
  LOCAL_STORAGE_DIR: Joi.string().optional().default('./storage'),
  AWS_REGION: whenS3(Joi.string()),
  ASSETS_BUCKET: whenS3(Joi.string()),
  AWS_ACCESS_KEY_ID: whenS3(Joi.string()),
  AWS_SECRET_ACCESS_KEY: whenS3(Joi.string()),
  CLOUDFRONT_DOMAIN: whenS3(Joi.string()),
  CLOUDFRONT_KEY_PAIR_ID: whenS3(Joi.string()),
  // CloudFront signing key: supply EITHER a base64-encoded PEM inline
  // (CLOUDFRONT_PRIVATE_KEY_B64) or a path to a PEM file (CLOUDFRONT_PRIVATE_KEY_PATH).
  CLOUDFRONT_PRIVATE_KEY_PATH: Joi.string().allow('').optional(),
  CLOUDFRONT_PRIVATE_KEY_B64: Joi.string().allow('').optional(),
  DATA_ENCRYPTION_KMS_KEY_ARN: Joi.string().allow('').optional(),

  // Orphaned-FileAsset sweep: assets referenced by nothing and older than this
  // many hours are deleted by the daily cron / manual endpoint.
  FILE_ORPHAN_TTL_HOURS: Joi.number().integer().min(1).optional().default(24),

  // MAIL_TRANSPORT=log (default) renders + logs the email — no key, no network.
  MAIL_TRANSPORT: Joi.string().valid('brevo', 'log').optional().default('log'),
  BREVO_API_KEY: Joi.string().when('MAIL_TRANSPORT', {
    is: 'brevo',
    then: Joi.required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MAIL_FROM_EMAIL: Joi.string().email().optional().default('no-reply@example.com'),
  MAIL_FROM_NAME: Joi.string().optional().default('Groundwork'),
  APP_WEB_URL: Joi.string().uri().optional().default('http://localhost:3000'),

  // Seed admin (bun run db:seed)
  ADMIN_EMAIL: Joi.string().email().optional(),
  ADMIN_USERNAME: Joi.string().optional(),
  ADMIN_PASSWORD: Joi.string().optional(),
});
