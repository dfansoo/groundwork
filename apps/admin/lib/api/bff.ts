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

/**
 * Fetch a non-JSON response through the BFF and hand it to the browser as a file.
 *
 * The export endpoint needs a bearer token, so it cannot simply be an <a href>;
 * the proxy passes content-type and content-disposition through for exactly this.
 */
export async function bffDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api/bff/${path}`);
  if (!res.ok) {
    throw new ApiError(res.status, `Download failed (${res.status})`);
  }

  const url = URL.createObjectURL(await res.blob());
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
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
