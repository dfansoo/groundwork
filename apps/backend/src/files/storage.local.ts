import { mkdir, writeFile, rm, stat, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { HeadResult, StorageDriver } from './storage.driver';

/**
 * Disk-backed storage. This is the default driver, and it is what lets a fresh
 * clone of the template run with nothing but Postgres — no AWS account, no
 * CloudFront keypair.
 *
 * It is a development driver: "presigned" upload URLs are unsigned, and private
 * URLs are not actually secret. Use FILES_DRIVER=s3 in production.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly bucketName = 'local';

  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
  ) {}

  presignPut(
    key: string,
    _contentType: string,
    expiresInSeconds = 300,
  ): Promise<{ url: string; expiresAt: Date }> {
    return Promise.resolve({
      url: this.urlFor(key),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    // S3 stores the content type with the object; on disk we keep it beside the
    // bytes so headObject() can answer the same question.
    await writeFile(`${path}.meta`, contentType, 'utf8');
  }

  async headObject(key: string): Promise<HeadResult | null> {
    const path = this.pathFor(key);
    try {
      const info = await stat(path);
      let contentType = 'application/octet-stream';
      try {
        contentType = (await readFile(`${path}.meta`, 'utf8')).trim();
      } catch {
        // Written outside putObject (e.g. a direct browser PUT that skipped the
        // sidecar). Fall back rather than pretending the object is missing.
      }
      return { contentLength: info.size, contentType };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const path = this.pathFor(key);
    await rm(path, { force: true });
    await rm(`${path}.meta`, { force: true });
  }

  publicUrl(key: string): string {
    return this.urlFor(key);
  }

  signPrivateUrl(key: string, _ttlSeconds = 300): string {
    // Nothing to sign on disk. The URL is not secret — that is a property of the
    // local driver, and the reason it is not for production.
    return this.urlFor(key);
  }

  private urlFor(key: string): string {
    return `${this.baseUrl}/v1/files/local/${key}`;
  }

  /** Keys come from user input, so a traversal must not be able to escape the root. */
  private pathFor(key: string): string {
    const root = resolve(this.root);
    const path = resolve(root, key);
    if (path !== root && !path.startsWith(root + sep)) {
      throw new Error(`Invalid key: ${key}`);
    }
    return path;
  }
}
