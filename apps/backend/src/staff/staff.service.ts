import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    return buildPaginatedResult(rows.map((u) => this.toView(u)), total, page, limit);
  }

  async replaceRoles(id: string, roles: Role[], actorId: string): Promise<StaffView> {
    await this.findOne(id);
    const updated = await this.repo.replaceRoles(id, roles);
    await this.audit.record({
      actorId,
      action: 'staff.roles.replace',
      entity: 'User',
      entityId: id,
      meta: { roles },
    });
    return this.toView(updated);
  }

  async deactivate(id: string, actorId: string): Promise<{ deactivated: true }> {
    await this.findOne(id);
    await this.repo.deactivate(id);
    await this.audit.record({
      actorId,
      action: 'staff.deactivate',
      entity: 'User',
      entityId: id,
    });
    return { deactivated: true };
  }
}
