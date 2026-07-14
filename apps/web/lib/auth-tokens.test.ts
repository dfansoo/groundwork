import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

process.env.API_URL = "http://backend.test/v1";
process.env.AUTH_EXCHANGE_SECRET = "shh";

import { loginWithPassword, exchangeGoogle, refreshTokens, revokeSession } from "@/lib/auth-tokens";

const jwtWithExp = (expSeconds: number) =>
  `h.${btoa(JSON.stringify({ exp: expSeconds }))}.s`;

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });
const authData = {
  user: { id: "u1", username: "Jan Kowalski", email: "jan@x.com", avatar: null },
  access_token: jwtWithExp(2_000_000_000),
  refresh_token: "refresh-1",
};

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("auth-tokens", () => {
  it("loginWithPassword returns normalized tokens on success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(authData));
    const res = await loginWithPassword("jan@x.com", "pw");
    expect(fetchMock).toHaveBeenCalledWith("http://backend.test/v1/auth/login", expect.objectContaining({ method: "POST" }));
    expect(res).toMatchObject({
      user: { id: "u1", name: "Jan Kowalski", email: "jan@x.com", avatar: null },
      accessToken: authData.access_token,
      refreshToken: "refresh-1",
      accessTokenExpiresAt: 2_000_000_000 * 1000,
    });
  });

  it("loginWithPassword returns null on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await loginWithPassword("jan@x.com", "bad")).toBeNull();
  });

  it("exchangeGoogle sends the exchange secret header and a mapped identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(authData));
    await exchangeGoogle(
      { sub: "g1", email: "jan@x.com", name: "Jan Kowalski", picture: "https://pic", email_verified: true },
      { providerAccountId: "g1", access_token: "ga", refresh_token: "gr", expires_at: 123, token_type: "Bearer", scope: "openid email", id_token: "id" },
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://backend.test/v1/auth/exchange");
    expect((init.headers as Record<string, string>)["x-auth-exchange-secret"]).toBe("shh");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ provider: "google", providerAccountId: "g1", email: "jan@x.com", username: "Jan Kowalski", avatar: "https://pic" });
    expect(typeof body.emailVerifiedAt).toBe("string");
  });

  it("exchangeGoogle returns null when the Google email is unverified", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const res = await exchangeGoogle(
      { sub: "g1", email: "jan@x.com", name: "Jan", picture: null, email_verified: false },
      { providerAccountId: "g1" },
    );
    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchangeGoogle falls back to the email local-part when the name is too short", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(authData));
    await exchangeGoogle(
      { sub: "g1", email: "traveller@x.com", name: "J", picture: null, email_verified: true },
      { providerAccountId: "g1" },
    );
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.username).toBe("traveller");
  });

  it("refreshTokens returns null on failure and tokens on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect(await refreshTokens("r")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(envelope(authData));
    expect(await refreshTokens("r")).toMatchObject({ refreshToken: "refresh-1" });
  });

  it("revokeSession never throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    await expect(revokeSession("r")).resolves.toBeUndefined();
  });
});
