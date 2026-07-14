import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// The admin console is private: everything except /login and the auth API needs a
// session. Signed-out visitors are bounced to /login.
const handler = auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
}) as (req: NextRequest) => Promise<Response | undefined>;

export default handler;

export const config = {
  // Everything except /login itself — guarding it would redirect it to itself,
  // forever — plus the auth API, Next internals, and static files.
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
