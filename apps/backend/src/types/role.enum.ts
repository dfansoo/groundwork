/**
 * Roles must stay in sync with the `Role` enum in prisma/schema.prisma.
 *
 * SUPER_ADMIN — everything, including staff management. Seeded, never self-assigned.
 * ADMIN       — runs the product day to day; can read staff but not change it.
 * EDITOR      — creates and edits content.
 * VIEWER      — read-only access to the admin console.
 * USER        — the default for a self-registered end user. No admin surface at all.
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  USER = 'USER',
}
