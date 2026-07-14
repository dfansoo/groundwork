import { ApiError } from "@/lib/api/public";

/** Browser-side call to an authenticated backend endpoint via the BFF proxy. */
export async function bffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/bff/${path}`, {
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

/** Upload a file directly to a presigned storage URL (not via the BFF proxy). */
export async function bffUpload(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new ApiError(res.status, `Upload failed (${res.status})`);
}
