import { Role } from './role.enum';
import {
  Permission,
  ROLE_PERMISSIONS,
  permissionsForRoles,
  rolesWithPermission,
} from './permission.enum';

describe('RBAC vocabulary', () => {
  it('grants SUPER_ADMIN every permission', () => {
    expect(ROLE_PERMISSIONS[Role.SUPER_ADMIN]).toEqual(Object.values(Permission));
  });

  it('gives USER no staff or audit access', () => {
    const perms = permissionsForRoles([Role.USER]);
    expect(perms.has(Permission.STAFF_READ)).toBe(false);
    expect(perms.has(Permission.AUDIT_READ)).toBe(false);
    expect(perms.size).toBe(0);
  });

  it('lets VIEWER read items but not write them', () => {
    const perms = permissionsForRoles([Role.VIEWER]);
    expect(perms.has(Permission.ITEMS_READ)).toBe(true);
    expect(perms.has(Permission.ITEMS_WRITE)).toBe(false);
  });

  it('unions permissions across multiple roles', () => {
    const perms = permissionsForRoles([Role.VIEWER, Role.EDITOR]);
    expect(perms.has(Permission.ITEMS_READ)).toBe(true);
    expect(perms.has(Permission.ITEMS_WRITE)).toBe(true);
  });

  it('reserves staff writes for SUPER_ADMIN alone', () => {
    expect(rolesWithPermission(Permission.STAFF_WRITE)).toEqual([Role.SUPER_ADMIN]);
  });

  it('derives the roles holding a permission rather than hardcoding them', () => {
    expect(rolesWithPermission(Permission.AUDIT_READ)).toEqual([Role.SUPER_ADMIN, Role.ADMIN]);
  });

  it('returns an empty set for a user with no roles', () => {
    expect(permissionsForRoles([]).size).toBe(0);
  });
});
