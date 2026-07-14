import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StaffRepository, UserWithRoles } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AuditService } from '../audit/audit.service';
import { Role } from '../types/role.enum';
import {
  PaginatedResult,
  buildPaginatedResult,
  getPaginationParams,
} from '../common/pagination';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

export interface StaffView {
  id: string;
  email: string;
  username: string;
  roles: Role[];
  createdAt: Date;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly audit: AuditService,
  ) {}

  private toView(user: UserWithRoles): StaffView {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles.map((r) => r.role as Role),
      createdAt: user.createdAt,
    };
  }

  async create(dto: CreateStaffDto, actorId: string): Promise<StaffView> {
    const email = dto.email.trim().toLowerCase();
    if (await this.repo.existsByEmail(email)) {
      throw new ConflictException('A user with this email already exists');
    }
    const user = await this.repo.create({
      email,
      username: dto.username.trim(),
      password: await bcrypt.hash(dto.password, 10),
      roles: dto.roles,
    });
    await this.audit.record({
      actorId,
      action: 'staff.create',
      entity: 'User',
      entityId: user.id,
      meta: { roles: dto.roles },
    });
    return this.toView(user);
  }

  async findOne(id: string): Promise<StaffView> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Staff member not found');
    return this.toView(user);
  }

  async list(query: ListStaffQueryDto): Promise<PaginatedResult<StaffView>> {
    const { skip, take, page, limit } = getPaginationParams(query);
    const filters = { search: query.search?.trim(), role: query.role };
    const [rows, total] = await Promise.all([
      this.repo.findManyStaff(filters, skip, take),
      this.repo.countStaff(filters),
    ]);
    return buildPaginatedResult(
      rows.map((u) => this.toView(u)),
      total,
      page,
      limit,
    );
  }

  async replaceRoles(
    id: string,
    roles: Role[],
    actorId: string,
  ): Promise<StaffView> {
    // (userId, role) is unique, so a client sending the same role twice would
    // otherwise fail on the constraint rather than simply granting it once.
    const wanted = [...new Set(roles)];

    const current = await this.findOne(id);
    await this.assertSuperAdminsSurvive(current, wanted);

    const updated = await this.repo.replaceRoles(id, wanted);
    await this.audit.record({
      actorId,
      action: 'staff.roles.replace',
      entity: 'User',
      entityId: id,
      meta: { roles: wanted },
    });
    return this.toView(updated);
  }

  async deactivate(
    id: string,
    actorId: string,
  ): Promise<{ deactivated: true }> {
    // Revoking your own access logs you out of the console you would need in
    // order to undo it.
    if (id === actorId) {
      throw new BadRequestException('You cannot revoke your own access');
    }

    const current = await this.findOne(id);
    await this.assertSuperAdminsSurvive(current, []);

    await this.repo.deactivate(id);
    await this.audit.record({
      actorId,
      action: 'staff.deactivate',
      entity: 'User',
      entityId: id,
    });
    return { deactivated: true };
  }

  /**
   * Refuses any change that would leave the system with no SUPER_ADMIN.
   *
   * Demoting or revoking the last one is unrecoverable through the product: no
   * remaining account can grant the role back, so the only way out is a hand-run
   * SQL statement against production.
   */
  private async assertSuperAdminsSurvive(
    current: StaffView,
    nextRoles: Role[],
  ): Promise<void> {
    const losingSuperAdmin =
      current.roles.includes(Role.SUPER_ADMIN) &&
      !nextRoles.includes(Role.SUPER_ADMIN);

    if (!losingSuperAdmin) return;

    const holders = await this.repo.countHoldersOfRole(Role.SUPER_ADMIN);
    if (holders <= 1) {
      throw new BadRequestException(
        'This is the last SUPER_ADMIN. Promote another account first, or nobody will be able to administer the system.',
      );
    }
  }
}
