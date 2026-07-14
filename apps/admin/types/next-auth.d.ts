import type { DefaultSession } from "next-auth";
import type { BackendTokens } from "@/lib/auth-tokens";
import type { Role } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      avatar: string | null;
      roles: Role[];
    } & NonNullable<DefaultSession["user"]>;
    error?: "RefreshTokenError";
  }
  interface User {
    backend?: BackendTokens;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    roles?: Role[];
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: "RefreshTokenError";
  }
}
