import { describe, it, expect } from "vitest";
import { ApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("preserves the per-field details of a 422 from the ValidationPipe", () => {
    const err = toApiError(422, {
      statusCode: 422,
      error: "Unprocessable Entity",
      message: "Validation failed",
      details: [{ property: "email", constraints: { isEmail: "email must be an email" } }],
    });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe("Validation failed");
    expect(err.details?.[0]?.property).toBe("email");
    expect(err.details?.[0]?.constraints?.isEmail).toBe("email must be an email");
  });

  it("carries the message from the exception filter envelope", () => {
    const err = toApiError(409, {
      success: false,
      statusCode: 409,
      error: "CONFLICT",
      message: 'An item with the slug "hello-world" already exists',
    });

    expect(err.status).toBe(409);
    expect(err.message).toContain("already exists");
    expect(err.details).toBeUndefined();
  });

  it("falls back to a generic message when the body is not the standard envelope", () => {
    const err = toApiError(500, "boom");

    expect(err.status).toBe(500);
    expect(err.message).toBe("Request failed with status 500");
  });

  it("falls back when the body is null", () => {
    const err = toApiError(503, null);

    expect(err.status).toBe(503);
    expect(err.message).toBe("Request failed with status 503");
  });

  it("exposes fieldErrors as a property -> message map for form binding", () => {
    const err = toApiError(422, {
      message: "Validation failed",
      details: [
        { property: "title", constraints: { minLength: "title is too short" } },
        { property: "email", constraints: { isEmail: "email must be an email" } },
      ],
    });

    expect(err.fieldErrors()).toEqual({
      title: "title is too short",
      email: "email must be an email",
    });
  });

  it("returns an empty field map when there are no details", () => {
    expect(toApiError(500, "boom").fieldErrors()).toEqual({});
  });
});
