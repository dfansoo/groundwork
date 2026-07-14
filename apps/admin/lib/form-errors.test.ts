import { describe, expect, it, vi } from "vitest";
import { applyApiErrors } from "@/lib/form-errors";
import { ApiError } from "@/lib/api/public";

describe("applyApiErrors", () => {
  it("returns false and never calls setError for a non-ApiError", () => {
    const setError = vi.fn();
    const result = applyApiErrors(new Error("boom"), setError);
    expect(result).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("maps each detail's first constraint onto the matching field and returns true", () => {
    const setError = vi.fn();
    const error = new ApiError(422, "Validation failed", [
      { property: "email", constraints: { isEmail: "Enter a valid email" } },
    ]);
    const result = applyApiErrors(error, setError);
    expect(result).toBe(true);
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Enter a valid email",
    });
  });

  it("returns false when the ApiError has no details", () => {
    const setError = vi.fn();
    const error = new ApiError(422, "Validation failed");
    const result = applyApiErrors(error, setError);
    expect(result).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("maps fields when the backend double-wraps details as { details: [...] }", () => {
    const setError = vi.fn();
    const error = new ApiError(422, "Validation failed", {
      details: [{ property: "name", constraints: { isString: "Name is required" } }],
    });
    const result = applyApiErrors(error, setError);
    expect(result).toBe(true);
    expect(setError).toHaveBeenCalledWith("name", { type: "server", message: "Name is required" });
  });
});
