import { Injectable, Logger } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { ActorWithRoles, AuditInput, AuditRepository } from './audit.repository';
import { Role } from '../types/role.enum';
import {
  PaginatedResult,
  buildPaginatedResult,
  getPaginationParams,
} from '../common/pagination';
import { ListAuditEventsQueryDto } from './dto/list-audit-events-query.dto';

export type { AuditInput } from './audit.repository';

export interface AuditActorView {
  id: string;
  username: string;
  email: string;
  roles: Role[];
}

export interface AuditEventView {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: Date;
  meta: unknown;
  actor: AuditActorView | null;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private static readonly EXPORT_CAP = 5000;

  constructor(private readonly repo: AuditRepository) {}

  async record(input: AuditInput): Promise<void> {
    await this.repo.create(input);
  }

  async list(query: ListAuditEventsQueryDto): Promise<PaginatedResult<AuditEventView>> {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = await this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.repo.findMany(where, skip, take),
      this.repo.count(where),
    ]);
    const actors = await this.resolveActors(rows);
    return buildPaginatedResult(
      rows.map((row) => this.toView(row, actors)),
      total,
      page,
      limit,
    );
  }

  async exportCsv(query: ListAuditEventsQueryDto): Promise<string> {
    const where = await this.buildWhere(query);
    const fetched = await this.repo.findMany(where, 0, AuditService.EXPORT_CAP + 1);
    const truncated = fetched.length > AuditService.EXPORT_CAP;
    const rows = truncated ? fetched.slice(0, AuditService.EXPORT_CAP) : fetched;
    if (truncated) {
      this.logger.warn(
        `Audit CSV export exceeded the ${AuditService.EXPORT_CAP}-row cap; output truncated to ${AuditService.EXPORT_CAP} rows`,
      );
    }
    const actors = await this.resolveActors(rows);
    const header = ['Timestamp', 'User', 'Email', 'Roles', 'Action', 'Entity', 'Entity ID'];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) {
      const actor = row.actorId ? (actors.get(row.actorId) ?? null) : null;
      const user = row.actorId ? (actor?.username ?? 'Unknown user') : 'System';
      lines.push(
        [
          row.createdAt.toISOString(),
          user,
          actor?.email ?? '',
          actor?.roles.join(' ') ?? '',
          row.action,
          row.entity,
          row.entityId,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\r\n');
  }

  private async buildWhere(query: ListAuditEventsQueryDto): Promise<Prisma.AuditLogWhereInput> {
    const where: Prisma.AuditLogWhereInput = {};
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) {
      createdAt.lte =
        query.to.length === 10 ? new Date(`${query.to}T23:59:59.999Z`) : new Date(query.to);
    }
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
    if (query.role) {
      where.actorId = { in: await this.repo.findUserIdsByRole(query.role) };
    }
    return where;
  }

  private async resolveActors(rows: AuditLog[]): Promise<Map<string, AuditActorView>> {
    const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
    const users = await this.repo.findActorsByIds(ids);
    return new Map(users.map((u) => [u.id, this.toActorView(u)] as const));
  }

  private toActorView(user: ActorWithRoles): AuditActorView {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map((r) => r.role as Role),
    };
  }

  private toView(row: AuditLog, actors: Map<string, AuditActorView>): AuditEventView {
    return {
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      createdAt: row.createdAt,
      meta: row.meta,
      actor: row.actorId ? (actors.get(row.actorId) ?? null) : null,
    };
  }
}
