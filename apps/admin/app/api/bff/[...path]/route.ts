import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";
import { usesSecureCookies } from "@/lib/secure-cookies";

async function proxy(req: NextRequest, path: string[]) {
  // Must tell getToken() whether the session cookie is `__Secure-` prefixed,
  // otherwise on an HTTPS deploy it looks for the wrong cookie name + salt and
  // returns null → a spurious 401. See lib/secure-cookies.ts.
  const token = await getToken({
    req,
    secret: env.AUTH_SECRET,
    secureCookie: usesSecureCookies(req),
  });
  if (!token?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (path.some((seg) => seg.includes(".."))) {
    return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  }
  const search = req.nextUrl.search;
  // Client paths are versioned (e.g. "v1/admin/staff", see lib/api.ts's apiFetch),
  // and env.API_URL already points at the versioned backend root (".../v1", see
  // lib/auth.ts's login/refresh calls). Strip the redundant leading "v1" segment
  // here so we don't double it up into ".../v1/v1/...".
  const upstreamPath = path[0] === "v1" ? path.slice(1) : path;
  const url = `${env.API_URL}/${upstreamPath.join("/")}${search}`;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.accessToken as string}`,
      },
      body: hasBody ? await req.text() : undefined,
    });
  } catch {
    return NextResponse.json({ message: "Upstream request failed" }, { status: 502 });
  }
  // 204/205/304 must not carry a body: constructing a Response with one throws.
  if ([204, 205, 304].includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }
  const text = await upstream.text();
  const headers: Record<string, string> = {
    "content-type": upstream.headers.get("content-type") ?? "application/json",
  };
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers["content-disposition"] = disposition;
  return new NextResponse(text, { status: upstream.status, headers });
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => proxy(req, (await ctx.params).path);

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
