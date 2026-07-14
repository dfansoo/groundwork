import { env } from "@/lib/env";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface PublicOpts {
  params?: Record<string, string | number | undefined>;
  /** Seconds for Next ISR caching. `false` = always fresh (no-store). Default 300. */
  revalidate?: number | false;
}

function buildUrl(path: string, params?: PublicOpts["params"]): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const query = qs.toString();
  return `${env.API_URL}/${path}${query ? `?${query}` : ""}`;
}

/** Server-side read of a public backend endpoint. Unwraps `{success,data}`. No auth. */
export async function getPublic<T>(path: string, opts: PublicOpts = {}): Promise<T> {
  const url = buildUrl(path, opts.params);
  const init: RequestInit & { next?: { revalidate: number } } =
    opts.revalidate === false
      ? { cache: "no-store" }
      : { next: { revalidate: opts.revalidate ?? 300 } };
  const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;
  if (!res.ok) {
    const message = (body?.message as string) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body?.details);
  }
  return (body?.data ?? body) as T;
}
