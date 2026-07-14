import NextAuth, { type NextAuthResult } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import {
  loginWithPassword,
  refreshTokens,
  revokeSession,
  type BackendTokens,
} from "@/lib/auth-tokens";

function applyBackend(token: JWT, backend: BackendTokens): JWT {
  token.uid = backend.user.id;
  token.name = backend.user.name;
  token.email = backend.user.email;
  token.avatar = backend.user.avatar;
  token.roles = backend.user.roles;
  token.accessToken = backend.accessToken;
  token.refreshToken = backend.refreshToken;
  token.accessTokenExpiresAt = backend.accessTokenExpiresAt;
  token.error = undefined;
  return token;
}

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!email || !password) return null;
        const backend = await loginWithPassword(email, password);
        if (!backend) return null;
        return {
          id: backend.user.id,
          name: backend.user.name,
          email: backend.user.email,
          image: backend.user.avatar ?? undefined,
          backend,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in via credentials → tokens are on the authorized user.
      if (user?.backend) {
        return applyBackend(token, user.backend);
      }
      // Subsequent request with a still-valid access token.
      if (token.accessTokenExpiresAt && Date.now() < token.accessTokenExpiresAt - 60_000) {
        return token;
      }
      // Access token expired → try to refresh.
      if (token.refreshToken) {
        const refreshed = await refreshTokens(token.refreshToken);
        if (refreshed) return applyBackend(token, refreshed);
        token.error = "RefreshTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.name = token.name ?? null;
      session.user.email = token.email ?? "";
      session.user.avatar = token.avatar ?? null;
      session.user.roles = token.roles ?? [];
      session.error = token.error;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const refreshToken = "token" in message ? message.token?.refreshToken : undefined;
      if (refreshToken) await revokeSession(refreshToken);
    },
  },
});

// Annotated explicitly: with Bun's symlinked node_modules, TypeScript cannot name
// the inferred NextAuth types (TS2742) and refuses to emit them.
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
