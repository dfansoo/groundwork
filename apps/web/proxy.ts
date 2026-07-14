import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Next 16 "proxy" convention (formerly middleware). The public site is open; only
// the authenticated account area is guarded, redirecting signed-out visitors to
// /login with a callbackUrl so they land back where they started.
//
// The return type is annotated because Bun's symlinked node_modules stops
// TypeScript naming NextAuth's inferred handler type (TS2742).
const handler = auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
}) as (req: NextRequest) => Promise<Response | undefined>;

export default handler;

export const config = {
  matcher: ["/account/:path*"],
};
