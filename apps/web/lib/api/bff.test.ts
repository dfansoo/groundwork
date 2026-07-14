import { afterEach, describe, expect, it, vi } from "vitest";
import { bffFetch, bffUpload } from "@/lib/api/bff";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("bffFetch", () => {
  it("targets the /api/bff proxy and unwraps data", async () => {
    const fetchMock = mockFetch(200, { success: true, data: { id: "p1" } });
    vi.stubGlobal("fetch", fetchMock);
    const result = await bffFetch<{ id: string }>("auth/profile");
    expect(result).toEqual({ id: "p1" });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/bff/auth/profile");
  });

  it("throws ApiError with the backend message on non-ok", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { success: false, message: "Not your companion" }));
    await expect(bffFetch("v1/me/companions/x", { method: "DELETE" })).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Not your companion",
    });
  });
});

describe("bffUpload", () => {
  it("PUTs the raw file with its content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["hello"], "p.pdf", { type: "application/pdf" });
    await bffUpload("https://s3.test/put/abc", file);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://s3.test/put/abc",
      expect.objectContaining({ method: "PUT", headers: { "content-type": "application/pdf" } }),
    );
  });

  it("throws ApiError when the upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const file = new File(["x"], "p.pdf", { type: "application/pdf" });
    await expect(bffUpload("https://s3.test/put/abc", file)).rejects.toMatchObject({ status: 500 });
  });
});
