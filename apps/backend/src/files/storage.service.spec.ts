import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageService } from './storage.service';

const s3Mock = mockClient(S3Client);

function newPrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  return privateKey;
}

function makeConfigFrom(values: Record<string, string>) {
  const base: Record<string, string> = {
    // These cases exercise the S3 path, so they select it explicitly. With
    // FILES_DRIVER unset, the facade hands off to the local disk driver instead.
    FILES_DRIVER: 's3',
    AWS_REGION: 'eu-central-1',
    ASSETS_BUCKET: 'test-bucket',
    CLOUDFRONT_DOMAIN: 'cdn.test.net',
    CLOUDFRONT_KEY_PAIR_ID: 'KTESTPAIR',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secrettest',
    ...values,
  };
  return {
    get: (k: string) => base[k],
    getOrThrow: (k: string) => {
      const v = base[k];
      if (v === undefined) throw new Error(`Missing config: ${k}`);
      return v;
    },
  } as any;
}

// Default helper: private key on disk via CLOUDFRONT_PRIVATE_KEY_PATH.
function makeConfig() {
  const dir = mkdtempSync(join(tmpdir(), 'cf-'));
  const pemPath = join(dir, 'cf.pem');
  writeFileSync(pemPath, newPrivateKeyPem());
  return makeConfigFrom({ CLOUDFRONT_PRIVATE_KEY_PATH: pemPath });
}

describe('StorageService', () => {
  beforeEach(() => s3Mock.reset());

  it('publicUrl builds a CloudFront URL', () => {
    const svc = new StorageService(makeConfig());
    expect(svc.publicUrl('public/items/x.jpg')).toBe(
      'https://cdn.test.net/public/items/x.jpg',
    );
  });

  it('presignPut returns a signed S3 URL and an expiry', async () => {
    const svc = new StorageService(makeConfig());
    const { url, expiresAt } = await svc.presignPut('public/items/x.jpg', 'image/jpeg');
    expect(url).toContain('test-bucket');
    expect(url).toContain('X-Amz-Signature=');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('headObject returns normalized metadata', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1234, ContentType: 'image/png' });
    const svc = new StorageService(makeConfig());
    await expect(svc.headObject('k')).resolves.toEqual({
      contentLength: 1234,
      contentType: 'image/png',
    });
  });

  it('headObject returns null on 404', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('Not Found'), { $metadata: { httpStatusCode: 404 } }),
    );
    const svc = new StorageService(makeConfig());
    await expect(svc.headObject('k')).resolves.toBeNull();
  });

  it('rethrows non-404 errors from headObject', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('boom'));
    const svc = new StorageService(makeConfig());
    await expect(svc.headObject('k')).rejects.toThrow('boom');
  });

  it('deleteObject sends a DeleteObjectCommand', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    const svc = new StorageService(makeConfig());
    await svc.deleteObject('k');
    expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
  });

  it('signPrivateUrl returns a signed CloudFront URL', () => {
    const svc = new StorageService(makeConfig());
    const url = svc.signPrivateUrl('private/docs/x.pdf', 300);
    expect(url).toContain('https://cdn.test.net/private/docs/x.pdf?');
    expect(url).toContain('Signature=');
    expect(url).toContain('Key-Pair-Id=KTESTPAIR');
  });

  it('loads the private key from a base64 env var (no file path)', () => {
    const b64 = Buffer.from(newPrivateKeyPem(), 'utf8').toString('base64');
    const svc = new StorageService(
      makeConfigFrom({ CLOUDFRONT_PRIVATE_KEY_B64: b64 }),
    );
    const url = svc.signPrivateUrl('private/docs/x.pdf', 300);
    expect(url).toContain('https://cdn.test.net/private/docs/x.pdf?');
    expect(url).toContain('Signature=');
    expect(url).toContain('Key-Pair-Id=KTESTPAIR');
  });

  it('prefers the base64 env var over the file path when both are set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cf-'));
    const pemPath = join(dir, 'cf.pem');
    writeFileSync(pemPath, 'not-a-valid-key');
    const b64 = Buffer.from(newPrivateKeyPem(), 'utf8').toString('base64');
    const svc = new StorageService(
      makeConfigFrom({
        CLOUDFRONT_PRIVATE_KEY_B64: b64,
        CLOUDFRONT_PRIVATE_KEY_PATH: pemPath,
      }),
    );
    // Signing succeeds, proving the valid base64 key was used, not the junk file.
    expect(svc.signPrivateUrl('private/docs/x.pdf', 300)).toContain('Signature=');
  });

  it('throws a clear error when the base64 key does not decode to a PEM', () => {
    const b64 = Buffer.from('totally not a pem', 'utf8').toString('base64');
    expect(
      () => new StorageService(makeConfigFrom({ CLOUDFRONT_PRIVATE_KEY_B64: b64 })),
    ).toThrow(/CLOUDFRONT_PRIVATE_KEY_B64/);
  });

  describe('driver selection', () => {
    // The point of the local driver: a fresh clone boots with no cloud config at
    // all. Constructing the service with an empty config must not throw.
    const emptyConfig = { get: () => undefined, getOrThrow: () => undefined } as any;

    it('defaults to the local driver and needs no AWS configuration', () => {
      const svc = new StorageService(emptyConfig);

      expect(svc.bucketName).toBe('local');
      expect(svc.publicUrl('public/item/a.png')).toBe(
        'http://localhost:9000/v1/files/local/public/item/a.png',
      );
    });

    it('routes to S3 when FILES_DRIVER=s3', () => {
      const svc = new StorageService(makeConfig());

      expect(svc.bucketName).toBe('test-bucket');
      expect(svc.publicUrl('public/item/a.png')).toBe(
        'https://cdn.test.net/public/item/a.png',
      );
    });
  });
});
