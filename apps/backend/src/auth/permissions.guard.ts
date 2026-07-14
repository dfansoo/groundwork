import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import { Permission, permissionsForRoles } from '../types/permission.enum';
import { Role } from '../types/role.enum';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const roles = (request.user?.roles ?? []) as Role[];
    const granted = permissionsForRoles(roles);

    return required.every((perm) => granted.has(perm));
  }
}
