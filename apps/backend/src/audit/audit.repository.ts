import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../types/role.enum';

export interface AuditInput {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  meta?: Record<string, unknown>;
}

export type ActorWithRoles = User & { roles: UserRole[] };

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: AuditInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: input.meta as Prisma.InputJsonValue | undefined,
      },
    });
  }

  findMany(where: Prisma.AuditLogWhereInput, skip: number, take: number): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(where: Prisma.AuditLogWhereInput): Promise<number> {
    return this.prisma.auditLog.count({ where });
  }

  async findUserIdsByRole(role: Role): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { role },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  findActorsByIds(ids: string[]): Promise<ActorWithRoles[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: { roles: true },
    });
  }
}
