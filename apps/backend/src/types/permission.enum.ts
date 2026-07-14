import { Role } from './role.enum';

/**
 * The permission vocabulary every feature guards against. `ITEMS_*` belongs to
 * the example feature — rename it alongside src/items when you build a real one,
 * and add a pair per resource.
 */
export enum Permission {
  STAFF_READ = 'STAFF_READ',
  STAFF_WRITE = 'STAFF_WRITE',
  ITEMS_READ = 'ITEMS_READ',
  ITEMS_WRITE = 'ITEMS_WRITE',
  ASSETS_READ = 'ASSETS_READ',
  ASSETS_WRITE = 'ASSETS_WRITE',
  AUDIT_READ = 'AUDIT_READ',
}

const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: ALL_PERMISSIONS,
  [Role.ADMIN]: [
    Permission.STAFF_READ,
    Permission.ITEMS_READ,
    Permission.ITEMS_WRITE,
    Permission.ASSETS_READ,
    Permission.ASSETS_WRITE,
    Permission.AUDIT_READ,
  ],
  [Role.EDITOR]: [
    Permission.ITEMS_READ,
    Permission.ITEMS_WRITE,
    Permission.ASSETS_READ,
    Permission.ASSETS_WRITE,
  ],
  [Role.VIEWER]: [Permission.ITEMS_READ, Permission.ASSETS_READ],
  // A self-registered end user. Deliberately empty: the admin console is not for them.
  [Role.USER]: [],
};

export function permissionsForRoles(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) set.add(perm);
  }
  return set;
}

/** Every role whose permission set includes `permission`. Derived, never hardcoded. */
export function rolesWithPermission(permission: Permission): Role[] {
  return (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}
