export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "VIEWER" | "USER";

export type Permission =
  | "STAFF_READ"
  | "STAFF_WRITE"
  | "ITEMS_READ"
  | "ITEMS_WRITE"
  | "ASSETS_READ"
  | "ASSETS_WRITE"
  | "AUDIT_READ";

/**
 * MIRROR of the backend's src/types/permission.enum.ts ROLE_PERMISSIONS.
 *
 * This drives UX only — which nav entries and buttons a user sees. The backend
 * remains the sole authority: every call goes through the BFF and is checked by
 * PermissionsGuard server-side, so a tampered client gets a 403, not access.
 *
 * Keep this in sync when the backend map changes.
 */
const ALL: Permission[] = [
  "STAFF_READ",
  "STAFF_WRITE",
  "ITEMS_READ",
  "ITEMS_WRITE",
  "ASSETS_READ",
  "ASSETS_WRITE",
  "AUDIT_READ",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    "STAFF_READ",
    "ITEMS_READ",
    "ITEMS_WRITE",
    "ASSETS_READ",
    "ASSETS_WRITE",
    "AUDIT_READ",
  ],
  EDITOR: ["ITEMS_READ", "ITEMS_WRITE", "ASSETS_READ", "ASSETS_WRITE"],
  VIEWER: ["ITEMS_READ", "ASSETS_READ"],
  // A self-registered end user. No admin surface at all.
  USER: [],
};

export function hasPermission(roles: Role[], perm: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}
