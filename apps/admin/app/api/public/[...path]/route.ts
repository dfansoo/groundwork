import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

async function proxy(req: NextRequest, path: string[]) {
  if (path.some((seg) => seg.includes(".."))) {
    return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  }
  const upstreamPath = path[0] === "v1" ? path.slice(1) : path;
  const url = `${env.API_URL}/${upstreamPath.join("/")}${req.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: hasBody ? await req.text() : undefined,
    });
  } catch {
    return NextResponse.json({ message: "Upstream request failed" }, { status: 502 });
  }
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => proxy(req, (await ctx.params).path);

export { handler as GET, handler as POST };
