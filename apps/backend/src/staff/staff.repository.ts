import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../types/role.enum';

export type UserWithRoles = User & { roles: UserRole[] };

export interface StaffFilters {
  search?: string;
  role?: Role;
}

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    email: string;
    username: string;
    password: string;
    roles: Role[];
  }): Promise<UserWithRoles> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
        roles: { create: data.roles.map((role) => ({ role })) },
      },
      include: { roles: true },
    });
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
  }

  private staffWhere(filters: StaffFilters): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [
      { roles: { some: { role: { not: Role.USER } } } },
    ];
    if (filters.role) {
      and.push({ roles: { some: { role: filters.role } } });
    }
    if (filters.search) {
      and.push({
        OR: [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: and };
  }

  async findManyStaff(
    filters: StaffFilters,
    skip: number,
    take: number,
  ): Promise<UserWithRoles[]> {
    return this.prisma.user.findMany({
      where: this.staffWhere(filters),
      include: { roles: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async countStaff(filters: StaffFilters): Promise<number> {
    return this.prisma.user.count({ where: this.staffWhere(filters) });
  }

  async replaceRoles(id: string, roles: Role[]): Promise<UserWithRoles> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: id, role })),
      });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { roles: true },
      });
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return Boolean(found);
  }

  async countHoldersOfRole(role: Role): Promise<number> {
    return this.prisma.userRole.count({ where: { role } });
  }
}
