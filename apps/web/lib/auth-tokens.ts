import { env } from "@/lib/env";

export interface BackendTokens {
  user: { id: string; name: string; email: string; avatar: string | null };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // epoch ms
}

export interface GoogleProfileLike {
  sub?: string;
  email?: string;
  name?: string | null;
  picture?: string | null;
  email_verified?: boolean;
}
export interface GoogleAccountLike {
  providerAccountId?: string;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  scope?: string;
  expires_at?: number;
}

interface AuthResponse {
  user: { id: string; username: string; email: string; avatar: string | null };
  access_token: string;
  refresh_token: string;
}

// Edge-safe (no Buffer): decode the JWT `exp` claim just to schedule refresh.
// The backend still validates the token on use, so this is advisory only.
function jwtExpiryMs(token: string): number {
  try {
    const seg = token.split(".")[1] ?? "";
    const base64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as { exp?: number };
    if (typeof json.exp === "number") return json.exp * 1000;
  } catch {
    // fall through to a conservative default
  }
  return Date.now() + 15 * 60 * 1000;
}

function normalize(r: AuthResponse): BackendTokens {
  return {
    user: {
      id: r.user.id,
      name: r.user.username,
      email: r.user.email,
      avatar: r.user.avatar ?? null,
    },
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    accessTokenExpiresAt: jwtExpiryMs(r.access_token),
  };
}

async function postAuth(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<BackendTokens | null> {
  let res: Response;
  try {
    res = await fetch(`${env.API_URL}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const parsed = (await res.json()) as { data?: AuthResponse } & Partial<AuthResponse>;
  const data = (parsed.data ?? parsed) as AuthResponse;
  return normalize(data);
}

export function loginWithPassword(email: string, password: string): Promise<BackendTokens | null> {
  return postAuth("auth/login", { email, password });
}

function googleUsername(profile: GoogleProfileLike): string {
  const name = (profile.name ?? "").trim();
  const base = name.length >= 2 ? name : (profile.email?.split("@")[0] ?? "");
  const safe = base.length >= 2 ? base : "Traveller";
  return safe.slice(0, 60);
}

export function exchangeGoogle(
  profile: GoogleProfileLike,
  account: GoogleAccountLike,
): Promise<BackendTokens | null> {
  if (!profile.email_verified || !profile.email) return Promise.resolve(null);
  return postAuth(
    "auth/exchange",
    {
      provider: "google",
      providerAccountId: account.providerAccountId ?? profile.sub,
      email: profile.email,
      username: googleUsername(profile),
      avatar: profile.picture ?? undefined,
      emailVerifiedAt: new Date().toISOString(),
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      idToken: account.id_token,
      tokenType: account.token_type,
      scope: account.scope,
      expiresAt: account.expires_at,
    },
    { "x-auth-exchange-secret": env.AUTH_EXCHANGE_SECRET },
  );
}

export function refreshTokens(refreshToken: string): Promise<BackendTokens | null> {
  return postAuth("auth/refresh", { refreshToken });
}

export async function revokeSession(refreshToken: string): Promise<void> {
  try {
    await fetch(`${env.API_URL}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // best-effort — sign-out must never fail because the backend is unreachable
  }
}
