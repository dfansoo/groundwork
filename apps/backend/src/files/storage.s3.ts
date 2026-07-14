import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignS3 } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as signCloudFrontUrl } from '@aws-sdk/cloudfront-signer';
import { HeadResult, StorageDriver } from './storage.driver';

/**
 * S3 for storage, CloudFront for delivery and signed private URLs.
 * Only constructed when FILES_DRIVER=s3 — the AWS config is read here rather
 * than at module load, so the app boots without it.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cloudFrontDomain: string;
  private readonly keyPairId: string;
  private readonly privateKey: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucket = this.config.getOrThrow<string>('ASSETS_BUCKET');
    this.cloudFrontDomain = this.config.getOrThrow<string>('CLOUDFRONT_DOMAIN');
    this.keyPairId = this.config.getOrThrow<string>('CLOUDFRONT_KEY_PAIR_ID');
    this.privateKey = this.loadPrivateKey();
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Resolves the CloudFront signing key. Prefers CLOUDFRONT_PRIVATE_KEY_B64 (a
   * base64-encoded PEM — convenient for a single-line .env at deploy time) and
   * falls back to reading the PEM file at CLOUDFRONT_PRIVATE_KEY_PATH (local dev).
   */
  private loadPrivateKey(): string {
    const b64 = this.config.get<string>('CLOUDFRONT_PRIVATE_KEY_B64');
    if (b64) {
      const pem = Buffer.from(b64, 'base64').toString('utf8');
      if (!pem.includes('-----BEGIN')) {
        throw new Error(
          'CLOUDFRONT_PRIVATE_KEY_B64 must be a base64-encoded PEM private key',
        );
      }
      return pem;
    }
    return readFileSync(
      this.config.getOrThrow<string>('CLOUDFRONT_PRIVATE_KEY_PATH'),
      'utf8',
    );
  }

  get bucketName(): string {
    return this.bucket;
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<{ url: string; expiresAt: Date }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await presignS3(this.s3, command, {
      expiresIn: expiresInSeconds,
    });
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }

  /**
   * Upload a buffer we generated ourselves (an invoice PDF, say). Presigning is for
   * bytes the browser holds; this is for bytes the server holds.
   */
  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async headObject(key: string): Promise<HeadResult | null> {
    try {
      const out = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentLength: out.ContentLength ?? 0,
        contentType: out.ContentType ?? 'application/octet-stream',
      };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return null;
      }
      throw err;
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await out.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  publicUrl(key: string): string {
    return `https://${this.cloudFrontDomain}/${key}`;
  }

  signPrivateUrl(key: string, ttlSeconds = 300): string {
    return signCloudFrontUrl({
      url: this.publicUrl(key),
      keyPairId: this.keyPairId,
      privateKey: this.privateKey,
      dateLessThan: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  }
}
