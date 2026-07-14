import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256-bit
const VERSION = 'v1'; // key/scheme version; `v2` reserved for KMS-envelope keys

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const b64 = config.get<string>('DATA_ENCRYPTION_KEY');
    if (!b64) {
      throw new InternalServerErrorException('DATA_ENCRYPTION_KEY is not configured');
    }
    const key = Buffer.from(b64, 'base64');
    if (key.length !== KEY_LENGTH) {
      throw new InternalServerErrorException(
        'DATA_ENCRYPTION_KEY must decode to 32 bytes',
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
  }

  decrypt(payload: string): string {
    const sep = payload.indexOf(':');
    const version = sep === -1 ? '' : payload.slice(0, sep);
    const b64 = sep === -1 ? '' : payload.slice(sep + 1);
    if (version !== VERSION || !b64) {
      throw new InternalServerErrorException('Invalid ciphertext format');
    }
    const raw = Buffer.from(b64, 'base64');
    if (raw.length < IV_LENGTH + TAG_LENGTH) {
      throw new InternalServerErrorException('Invalid ciphertext length');
    }
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Decryption failed');
    }
  }

  encryptNullable(value?: string | null): string | null {
    return value == null ? null : this.encrypt(value);
  }

  decryptNullable(value?: string | null): string | null {
    return value == null ? null : this.decrypt(value);
  }
}
