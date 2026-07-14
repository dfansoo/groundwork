import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, jest } from '@jest/globals';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import { Permission } from '../types/permission.enum';
import { Role } from '../types/role.enum';

describe('PermissionsGuard', () => {
  const make = (roles: Role[], required: Permission[]) => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    const guard = new PermissionsGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(ctx);
  };

  it('allows when no permissions are required', () => {
    expect(make([Role.USER], [])).toBe(true);
  });

  it('allows SUPER_ADMIN for any permission', () => {
    expect(make([Role.SUPER_ADMIN], [Permission.STAFF_WRITE])).toBe(true);
  });

  it('allows EDITOR to write items', () => {
    expect(make([Role.EDITOR], [Permission.ITEMS_WRITE])).toBe(true);
  });

  it('denies VIEWER from writing items', () => {
    expect(make([Role.VIEWER], [Permission.ITEMS_WRITE])).toBe(false);
  });

  it('denies ADMIN from writing staff — that is SUPER_ADMIN only', () => {
    expect(make([Role.ADMIN], [Permission.STAFF_WRITE])).toBe(false);
  });

  it('denies USER any admin permission', () => {
    expect(make([Role.USER], [Permission.ITEMS_READ])).toBe(false);
  });

  it('denies when user has no roles', () => {
    expect(make([], [Permission.ITEMS_READ])).toBe(false);
  });
});
