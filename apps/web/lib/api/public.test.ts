import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { API_URL: "http://backend.test/v1", AUTH_SECRET: "" } }));

import { ApiError, getPublic } from "@/lib/api/public";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("getPublic", () => {
  it("unwraps the {success,data} envelope", async () => {
    const fetchMock = mockFetch(200, { success: true, data: { id: "item_1" } });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getPublic<{ id: string }>("items/item_1");
    expect(result).toEqual({ id: "item_1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/v1/items/item_1",
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });

  it("appends query params and currency", async () => {
    const fetchMock = mockFetch(200, { success: true, data: [] });
    vi.stubGlobal("fetch", fetchMock);
    await getPublic("items", { params: { currency: "PLN", page: 2 } });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://backend.test/v1/items?currency=PLN&page=2");
  });

  it("throws ApiError with status + message on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(409, { success: false, message: "This package is temporarily unavailable" }),
    );
    await expect(getPublic("packages/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "This package is temporarily unavailable",
    });
  });

  it("exposes ApiError as an Error subclass", () => {
    const err = new ApiError(404, "nope");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
  });
});
