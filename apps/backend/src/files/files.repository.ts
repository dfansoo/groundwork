import { Injectable } from '@nestjs/common';
import { FileAsset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.FileAssetCreateInput): Promise<FileAsset> {
    return this.prisma.fileAsset.create({ data });
  }

  async findById(id: string): Promise<FileAsset | null> {
    return this.prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
  }

  async markReady(
    id: string,
    data: { sizeBytes: number; mimeType: string; url: string | null },
  ): Promise<FileAsset> {
    return this.prisma.fileAsset.update({
      where: { id },
      data: {
        sizeBytes: data.sizeBytes,
        mimeType: data.mimeType,
        url: data.url,
        status: 'READY',
      },
    });
  }

  async findMany(
    where: Prisma.FileAssetWhereInput,
    skip: number,
    take: number,
  ): Promise<FileAsset[]> {
    return this.prisma.fileAsset.findMany({
      where: { ...where, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.FileAssetWhereInput): Promise<number> {
    return this.prisma.fileAsset.count({ where: { ...where, deletedAt: null } });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.fileAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findManyByIds(ids: string[]): Promise<FileAsset[]> {
    if (ids.length === 0) return [];
    return this.prisma.fileAsset.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'READY' },
    });
  }

  /** Live (not soft-deleted) assets created before `cutoff` — sweep candidates. */
  async findSweepCandidates(
    cutoff: Date,
  ): Promise<Pick<FileAsset, 'id' | 'key' | 'status' | 'createdAt'>[]> {
    return this.prisma.fileAsset.findMany({
      where: { deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, key: true, status: true, createdAt: true },
    });
  }
}
