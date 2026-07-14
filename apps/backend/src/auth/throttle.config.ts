import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';

/** Throttler names. Referenced by @Throttle() overrides on individual routes. */
export const THROTTLER_IP = 'ip';
export const THROTTLER_CREDENTIALS = 'credentials';

function clientIp(req: Record<string, any>): string {
  const forwarded: string[] | undefined = req.ips;
  return forwarded?.length ? forwarded[0] : (req.ip as string);
}

function bodyEmail(req: Record<string, any>): string | null {
  const raw: unknown = req.body?.email;
  return typeof raw === 'string' && raw.trim()
    ? raw.trim().toLowerCase()
    : null;
}

/**
 * Two limits, deliberately, because either one alone has a hole.
 *
 * `ip` is the blunt per-host cap. On its own it is too coarse to protect an
 * account: everyone behind one office NAT shares a single budget, so the limit
 * either annoys real users or is set so high it stops nobody.
 *
 * `credentials` is keyed by (IP, email), so guesses against one account are
 * capped without spending anyone else's budget. On its own *that* has the
 * opposite hole — an attacker can rotate the email and get a fresh bucket every
 * time, which is why the `ip` cap still has to sit behind it.
 *
 * Neither survives an attacker rotating IPs. That is the account lockout's job
 * (AuthService.login); these two only make it expensive to get there.
 */
export const throttlers: ThrottlerOptions[] = [
  {
    name: THROTTLER_IP,
    ttl: 60_000,
    limit: 100,
  },
  {
    name: THROTTLER_CREDENTIALS,
    ttl: 60_000,
    limit: 20,
    getTracker: (req) => `${clientIp(req)}:${bodyEmail(req) ?? '<none>'}`,
    // Only meaningful where the caller names an account. Everywhere else the
    // tracker would collapse to the IP and double-count against the `ip` bucket.
    skipIf: (context: ExecutionContext) =>
      bodyEmail(context.switchToHttp().getRequest()) === null,
  },
];
