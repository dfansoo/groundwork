import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS, type Role } from "./permissions";

describe("hasPermission", () => {
  it("grants SUPER_ADMIN everything", () => {
    expect(hasPermission(["SUPER_ADMIN"], "STAFF_WRITE")).toBe(true);
    expect(hasPermission(["SUPER_ADMIN"], "AUDIT_READ")).toBe(true);
  });

  it("lets EDITOR write items but not touch staff", () => {
    expect(hasPermission(["EDITOR"], "ITEMS_WRITE")).toBe(true);
    expect(hasPermission(["EDITOR"], "STAFF_READ")).toBe(false);
  });

  it("keeps VIEWER read-only", () => {
    expect(hasPermission(["VIEWER"], "ITEMS_READ")).toBe(true);
    expect(hasPermission(["VIEWER"], "ITEMS_WRITE")).toBe(false);
  });

  it("reserves staff writes for SUPER_ADMIN — not even ADMIN", () => {
    expect(hasPermission(["ADMIN"], "STAFF_WRITE")).toBe(false);
  });

  it("gives a plain USER no admin surface", () => {
    expect(hasPermission(["USER"], "ITEMS_READ")).toBe(false);
    expect(ROLE_PERMISSIONS.USER).toEqual([]);
  });

  it("unions permissions across roles", () => {
    expect(hasPermission(["VIEWER", "EDITOR"], "ITEMS_WRITE")).toBe(true);
  });

  it("denies when the user has no roles", () => {
    expect(hasPermission([], "ITEMS_READ")).toBe(false);
  });

  it("covers exactly the roles the backend defines", () => {
    const roles: Role[] = ["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER", "USER"];
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...roles].sort());
  });
});
