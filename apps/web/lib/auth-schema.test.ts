import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/auth-schema";

describe("auth-schema", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "jan@x.com", password: "pw" }).success).toBe(true);
  });
  it("rejects a bad login email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "pw" }).success).toBe(false);
  });
  it("accepts a valid registration", () => {
    expect(
      registerSchema.safeParse({ name: "Jan Kowalski", email: "jan@x.com", password: "password1" })
        .success,
    ).toBe(true);
  });
  it("rejects a short password", () => {
    expect(
      registerSchema.safeParse({ name: "Jan", email: "jan@x.com", password: "short" }).success,
    ).toBe(false);
  });
  it("rejects a name with digits", () => {
    expect(
      registerSchema.safeParse({ name: "Jan3", email: "jan@x.com", password: "password1" }).success,
    ).toBe(false);
  });
});

describe("forgot/reset schemas", () => {
  it("forgot accepts a valid email, rejects a bad one", () => {
    expect(forgotPasswordSchema.safeParse({ email: "jan@x.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
  it("reset requires 8+ chars and matching confirmation", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "password1", confirm: "password1" }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: "password1", confirm: "different1" }).success,
    ).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(
      false,
    );
  });
});
