import { validationSchema } from './env.validation';

const base = {
  NODE_ENV: 'test',
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DATA_ENCRYPTION_KEY: 'a'.repeat(44),
};

const s3Config = {
  AWS_REGION: 'eu-central-1',
  ASSETS_BUCKET: 'assets',
  AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'secret',
  CLOUDFRONT_DOMAIN: 'cdn.example.com',
  CLOUDFRONT_KEY_PAIR_ID: 'K123',
};

describe('validationSchema', () => {
  it('requires the core secrets', () => {
    const { error } = validationSchema.validate({});
    expect(error).toBeDefined();
  });

  it('defaults FILES_DRIVER to local and validates with no cloud config at all', () => {
    const { error, value } = validationSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value.FILES_DRIVER).toBe('local');
    expect(value.LOCAL_STORAGE_DIR).toBe('./storage');
  });

  it('requires AWS + CloudFront config when FILES_DRIVER=s3', () => {
    const { error } = validationSchema.validate({
      ...base,
      FILES_DRIVER: 's3',
    });
    expect(error).toBeDefined();
  });

  it('accepts FILES_DRIVER=s3 when the cloud config is present', () => {
    const { error } = validationSchema.validate({
      ...base,
      FILES_DRIVER: 's3',
      ...s3Config,
    });
    expect(error).toBeUndefined();
  });

  it('defaults MAIL_TRANSPORT to log and needs no Brevo key', () => {
    const { error, value } = validationSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value.MAIL_TRANSPORT).toBe('log');
  });

  it('requires BREVO_API_KEY when MAIL_TRANSPORT=brevo', () => {
    const { error } = validationSchema.validate({
      ...base,
      MAIL_TRANSPORT: 'brevo',
    });
    expect(error).toBeDefined();
  });

  it('defaults ALLOWED_ORIGINS to the two local frontends', () => {
    const { value } = validationSchema.validate(base);
    expect(value.ALLOWED_ORIGINS).toBe(
      'http://localhost:3000,http://localhost:3001',
    );
  });

  describe('AUTH_EXCHANGE_SECRET', () => {
    // The default is committed to this repository, so it is public in every
    // clone. Booting production with it means anyone can mint a session for any
    // email through /v1/auth/exchange.
    it('falls back to the shared development default outside production', () => {
      const { error, value } = validationSchema.validate(base);
      expect(error).toBeUndefined();
      expect(value.AUTH_EXCHANGE_SECRET).toBe(
        'local-auth-exchange-secret-please-change',
      );
    });

    it('refuses to boot in production when it is unset', () => {
      const { error } = validationSchema.validate({
        ...base,
        NODE_ENV: 'production',
      });
      expect(error?.message).toMatch(
        /AUTH_EXCHANGE_SECRET must be set in production/,
      );
    });

    it('rejects a short secret in production', () => {
      const { error } = validationSchema.validate({
        ...base,
        NODE_ENV: 'production',
        AUTH_EXCHANGE_SECRET: 'too-short',
      });
      expect(error?.message).toMatch(/at least 32 characters/);
    });

    it('accepts a generated secret in production', () => {
      const { error, value } = validationSchema.validate({
        ...base,
        NODE_ENV: 'production',
        AUTH_EXCHANGE_SECRET: 'x'.repeat(44),
      });
      expect(error).toBeUndefined();
      expect(value.AUTH_EXCHANGE_SECRET).toBe('x'.repeat(44));
    });
  });
});
