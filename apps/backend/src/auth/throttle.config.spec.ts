import { describe, expect, it } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import {
  throttlers,
  THROTTLER_CREDENTIALS,
  THROTTLER_IP,
} from './throttle.config';

const ip = throttlers.find((t) => t.name === THROTTLER_IP)!;
const credentials = throttlers.find((t) => t.name === THROTTLER_CREDENTIALS)!;

const ctx = (req: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const track = (req: Record<string, unknown>) =>
  credentials.getTracker!(req, ctx(req)) as string;

describe('throttlers', () => {
  it('keeps the blunt per-IP cap on every route', () => {
    expect(ip.limit).toBe(100);
    // No getTracker override: the default is the client IP, which is what we want
    // for the coarse cap.
    expect(ip.getTracker).toBeUndefined();
  });

  // Login must be able to reach the account lockout (ten consecutive failures).
  // A credentials limit at or below ten would return 429 first and the lockout
  // would never fire.
  it('sets the credentials limit above the ten-failure lockout threshold', () => {
    expect(credentials.limit).toBeGreaterThan(10);
  });

  describe('the credentials tracker', () => {
    it('buckets by IP and email together', () => {
      expect(track({ ip: '1.2.3.4', body: { email: 'jan@x.com' } })).toBe(
        '1.2.3.4:jan@x.com',
      );
    });

    // Two colleagues behind one office NAT must not share a login budget.
    it('gives two accounts on one IP separate buckets', () => {
      expect(track({ ip: '1.2.3.4', body: { email: 'jan@x.com' } })).not.toBe(
        track({ ip: '1.2.3.4', body: { email: 'ada@x.com' } }),
      );
    });

    // ...and one account attacked from two hosts gets two buckets, which is
    // precisely the hole the account lockout exists to close.
    it('gives one account attacked from two IPs separate buckets', () => {
      expect(track({ ip: '1.2.3.4', body: { email: 'jan@x.com' } })).not.toBe(
        track({ ip: '5.6.7.8', body: { email: 'jan@x.com' } }),
      );
    });

    it('normalises the email, so casing and padding cannot buy extra attempts', () => {
      expect(track({ ip: '1.2.3.4', body: { email: '  JAN@X.com ' } })).toBe(
        '1.2.3.4:jan@x.com',
      );
    });

    it('prefers the forwarded client IP behind a proxy', () => {
      expect(
        track({
          ip: '10.0.0.1',
          ips: ['9.9.9.9', '10.0.0.1'],
          body: { email: 'jan@x.com' },
        }),
      ).toBe('9.9.9.9:jan@x.com');
    });
  });

  describe('skipIf', () => {
    // Without this the tracker collapses to the bare IP on every other route and
    // silently double-counts against the `ip` bucket.
    it('skips the credentials throttler when the request names no account', () => {
      expect(credentials.skipIf!(ctx({ ip: '1.2.3.4', body: {} }))).toBe(true);
      expect(
        credentials.skipIf!(ctx({ ip: '1.2.3.4', body: { email: '  ' } })),
      ).toBe(true);
      expect(
        credentials.skipIf!(ctx({ ip: '1.2.3.4', body: { email: 42 } })),
      ).toBe(true);
    });

    it('applies it when the request does name an account', () => {
      expect(
        credentials.skipIf!(
          ctx({ ip: '1.2.3.4', body: { email: 'jan@x.com' } }),
        ),
      ).toBe(false);
    });
  });
});
