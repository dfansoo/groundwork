import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageDriver } from './storage.local';

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gw-storage-'));
    driver = new LocalStorageDriver(root, 'http://localhost:9000');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a bucket name so FileAsset rows look the same as under S3', () => {
    expect(driver.bucketName).toBe('local');
  });

  it('presigns an upload to our own local endpoint instead of S3', async () => {
    const { url, expiresAt } = await driver.presignPut(
      'public/item/a.png',
      'image/png',
    );
    expect(url).toBe('http://localhost:9000/v1/files/local/public/item/a.png');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('round-trips an object through disk, preserving content type', async () => {
    await driver.putObject(
      'public/item/a.png',
      Buffer.from('pngbytes'),
      'image/png',
    );

    expect(existsSync(join(root, 'public/item/a.png'))).toBe(true);

    const head = await driver.headObject('public/item/a.png');
    expect(head).toEqual({ contentLength: 8, contentType: 'image/png' });
  });

  it('returns null from headObject for a key that was never written', async () => {
    expect(await driver.headObject('public/item/missing.png')).toBeNull();
  });

  it('deletes an object and forgets its content type', async () => {
    await driver.putObject('public/item/a.png', Buffer.from('x'), 'image/png');
    await driver.deleteObject('public/item/a.png');

    expect(await driver.headObject('public/item/a.png')).toBeNull();
    expect(existsSync(join(root, 'public/item/a.png'))).toBe(false);
  });

  it('does not throw when deleting a key that is already gone', async () => {
    await expect(
      driver.deleteObject('nope/nothing.png'),
    ).resolves.toBeUndefined();
  });

  it('serves public and private URLs from the local endpoint', () => {
    expect(driver.publicUrl('public/item/a.png')).toBe(
      'http://localhost:9000/v1/files/local/public/item/a.png',
    );
    // There is nothing to sign locally — the URL is simply not secret in dev.
    expect(driver.signPrivateUrl('private/item/b.pdf')).toBe(
      'http://localhost:9000/v1/files/local/private/item/b.pdf',
    );
  });

  it('refuses keys that try to escape the storage root', async () => {
    await expect(
      driver.putObject('../../etc/passwd', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow(/invalid key/i);
  });
});
