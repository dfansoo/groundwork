import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { HeadResult, StorageDriver } from './storage.driver';
import { LocalStorageDriver } from './storage.local';
import { S3StorageDriver } from './storage.s3';

export { HeadResult } from './storage.driver';

/**
 * Facade over the storage drivers. The rest of the app injects this and never
 * needs to know which driver is behind it.
 *
 * FILES_DRIVER=local (default) — disk. Needs no cloud account, so a fresh clone
 * of the template runs immediately. FILES_DRIVER=s3 — S3 + CloudFront.
 *
 * Only the chosen driver is constructed, which is what keeps the AWS clients and
 * their required credentials out of the boot path in local mode.
 */
@Injectable()
export class StorageService implements StorageDriver {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(private readonly config: ConfigService) {
    const kind = this.config.get<string>('FILES_DRIVER') ?? 'local';

    if (kind === 's3') {
      this.driver = new S3StorageDriver(this.config);
    } else {
      const root = resolve(
        this.config.get<string>('LOCAL_STORAGE_DIR') ?? './storage',
      );
      const port = this.config.get<string>('PORT') ?? '9000';
      this.driver = new LocalStorageDriver(root, `http://localhost:${port}`);
      this.logger.warn(
        `FILES_DRIVER=local — uploads go to ${root} and are served unsigned. Use FILES_DRIVER=s3 in production.`,
      );
    }
  }

  get bucketName(): string {
    return this.driver.bucketName;
  }

  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    return this.driver.presignPut(key, contentType, expiresInSeconds);
  }

  putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.driver.putObject(key, body, contentType);
  }

  headObject(key: string): Promise<HeadResult | null> {
    return this.driver.headObject(key);
  }

  getObject(key: string): Promise<Buffer | null> {
    return this.driver.getObject(key);
  }

  deleteObject(key: string): Promise<void> {
    return this.driver.deleteObject(key);
  }

  publicUrl(key: string): string {
    return this.driver.publicUrl(key);
  }

  signPrivateUrl(key: string, ttlSeconds?: number): string {
    return this.driver.signPrivateUrl(key, ttlSeconds);
  }
}
