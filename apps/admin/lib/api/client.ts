import { ApiError } from "@/lib/api/public";

/** Browser-side call to a public backend endpoint via the Next passthrough. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;
  if (!res.ok) {
    const message = (body?.message as string) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body?.details);
  }
  return (body?.data ?? body) as T;
}
