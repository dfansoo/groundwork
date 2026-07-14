import { Injectable } from '@nestjs/common';
import { Item, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ItemUncheckedCreateInput): Promise<Item> {
    return this.prisma.item.create({ data });
  }

  update(id: string, data: Prisma.ItemUncheckedUpdateInput): Promise<Item> {
    return this.prisma.item.update({ where: { id }, data });
  }

  findById(id: string): Promise<Item | null> {
    return this.prisma.item.findFirst({ where: { id, deletedAt: null } });
  }

  findBySlug(slug: string): Promise<Item | null> {
    return this.prisma.item.findFirst({ where: { slug, deletedAt: null } });
  }

  findMany(
    where: Prisma.ItemWhereInput,
    orderBy: Prisma.ItemOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<Item[]> {
    return this.prisma.item.findMany({ where, orderBy, skip, take });
  }

  count(where: Prisma.ItemWhereInput): Promise<number> {
    return this.prisma.item.count({ where });
  }

  /**
   * Soft delete: the orphan sweep uses deletedAt to decide an asset is unreferenced.
   *
   * `freedSlug` retires the old slug. The unique index on slug spans every row,
   * deleted or not, so a soft-deleted item would otherwise reserve its title
   * forever — and because the lookup filters deletedAt, the service's collision
   * check would not even see it coming. Re-creating an item with a title you had
   * once used would land on the constraint instead.
   */
  async softDelete(id: string, freedSlug: string): Promise<void> {
    await this.prisma.item.update({
      where: { id },
      data: { deletedAt: new Date(), slug: freedSlug },
    });
  }
}
