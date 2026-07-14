const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";
const SESSION_COOKIE = "authjs.session-token";

/** The slice of NextRequest that secure-cookie detection needs. */
export interface SecureCookieRequest {
  cookies: { has(name: string): boolean };
  headers: Headers;
  nextUrl: { protocol: string };
}

/**
 * Decide whether Auth.js issued the session cookie in "secure" mode
 * (`__Secure-` prefix), which `getToken()` needs to know so it derives the
 * matching cookie name AND decryption salt.
 *
 * `@auth/core`'s getToken only reads `secureCookie` from its params (never from
 * env / AUTH_URL), and defaults it to falsy — so on an HTTPS deploy it looks for
 * the non-secure cookie name and fails. We reconstruct the decision here:
 *
 * 1. The session cookie the client actually holds is the source of truth —
 *    Auth.js adds the `__Secure-` prefix only for HTTPS sessions.
 * 2. Otherwise (no session yet) trust the proxy's `x-forwarded-proto`.
 * 3. Otherwise fall back to the request URL's protocol.
 */
export function usesSecureCookies(req: SecureCookieRequest): boolean {
  if (req.cookies.has(SECURE_SESSION_COOKIE)) return true;
  if (req.cookies.has(SESSION_COOKIE)) return false;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim() === "https";
  return req.nextUrl.protocol === "https:";
}
