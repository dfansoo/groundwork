export interface HeadResult {
  contentLength: number;
  contentType: string;
}

/**
 * The storage surface the rest of the app codes against. Two implementations:
 * LocalStorageDriver (disk — the default, needs no cloud account) and
 * S3StorageDriver (S3 + CloudFront signed URLs). Selected by FILES_DRIVER.
 */
export interface StorageDriver {
  readonly bucketName: string;

  /** A URL the browser can PUT bytes to directly. */
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<{ url: string; expiresAt: Date }>;

  /** For bytes the server itself holds (a generated PDF, say). */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Null when the object does not exist — this is how an unconfirmed upload is detected. */
  headObject(key: string): Promise<HeadResult | null>;

  /** Raw bytes, or null when the object does not exist. */
  getObject(key: string): Promise<Buffer | null>;

  deleteObject(key: string): Promise<void>;

  publicUrl(key: string): string;

  signPrivateUrl(key: string, ttlSeconds?: number): string;
}
