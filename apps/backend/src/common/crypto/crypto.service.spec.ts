import { describe, it, expect } from '@jest/globals';
import { CryptoService } from './crypto.service';

// 32-byte key, base64
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');
const config = { get: (_k: string) => TEST_KEY } as any;

describe('CryptoService', () => {
  const service = new CryptoService(config);

  it('round-trips a value', () => {
    const enc = service.encrypt('passport-12345');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('passport-12345');
    expect(service.decrypt(enc)).toBe('passport-12345');
  });

  it('produces different ciphertext each call (random IV)', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('throws when the ciphertext is tampered', () => {
    const enc = service.encrypt('secret');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('handles nullable helpers', () => {
    expect(service.encryptNullable(null)).toBeNull();
    expect(service.decryptNullable(undefined)).toBeNull();
    const enc = service.encryptNullable('x');
    expect(service.decryptNullable(enc)).toBe('x');
  });
});
