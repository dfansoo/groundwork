import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadImage } from "./upload";

function jpeg(name = "a.jpg", size = 1000): File {
  const blob = new Blob([new Uint8Array(size)], { type: "image/jpeg" });
  return new File([blob], name, { type: "image/jpeg" });
}

describe("uploadImage", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("rejects an unsupported type before calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const gif = new File([new Blob([new Uint8Array(10)], { type: "image/gif" })], "a.gif", {
      type: "image/gif",
    });
    await expect(uploadImage(gif)).rejects.toThrow(/Unsupported/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(uploadImage(jpeg("big.jpg", 11 * 1024 * 1024))).rejects.toThrow(/too large/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("runs init -> PUT -> confirm and returns { fileId, url }", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/api/bff/admin/files/uploads")) {
          return new Response(
            JSON.stringify({
              data: { assetId: "asset1", uploadUrl: "https://storage/put/asset1" },
            }),
            {
              status: 201,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url === "https://storage/put/asset1") {
          return new Response(null, { status: 200 });
        }
        if (url.endsWith("/api/bff/admin/files/asset1/confirm")) {
          return new Response(
            JSON.stringify({ data: { id: "asset1", url: "https://cdn/asset1.jpg" } }),
            {
              status: 201,
              headers: { "content-type": "application/json" },
            },
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      },
    );

    const result = await uploadImage(jpeg());
    expect(result).toEqual({ fileId: "asset1", url: "https://cdn/asset1.jpg" });
    expect(calls[0]).toBe("POST /api/bff/admin/files/uploads");
    expect(calls[1]).toBe("PUT https://storage/put/asset1");
    expect(calls[2]).toBe("POST /api/bff/admin/files/asset1/confirm");
  });
});
