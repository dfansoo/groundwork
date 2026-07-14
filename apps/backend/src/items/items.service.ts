import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Item, Prisma } from '@prisma/client';
import { ItemsRepository } from './items.repository';
import { AuditService } from '../audit/audit.service';
import { slugify } from '../common/slug';
import { buildOrderBy } from '../common/sorting';
import {
  PaginatedResult,
  buildPaginatedResult,
  getPaginationParams,
} from '../common/pagination';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';

/** Columns a client may sort by. Anything else falls back to createdAt desc. */
const SORTABLE = ['title', 'createdAt', 'updatedAt'] as const;

/**
 * The example feature. It exists to show, end to end, how a resource is built
 * here: validated DTOs in, slug derived from the title, RBAC enforced at the
 * controller, every mutation written to the audit log, soft deletes so the file
 * sweep can tell a live reference from a dead one.
 *
 * Copy this directory and the Item model, rename, delete the originals.
 */
@Injectable()
export class ItemsService {
  constructor(
    private readonly repo: ItemsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateItemDto, actorId: string): Promise<Item> {
    const slug = slugify(dto.title);
    if (await this.repo.findBySlug(slug)) {
      throw new ConflictException(`An item with the slug "${slug}" already exists`);
    }

    const item = await this.repo.create({
      title: dto.title,
      slug,
      description: dto.description ?? null,
      published: dto.published ?? false,
      imageFileIds: dto.imageFileIds ?? [],
    });

    await this.audit.record({
      actorId,
      action: 'items.create',
      entity: 'Item',
      entityId: item.id,
      meta: { title: item.title },
    });

    return item;
  }

  async update(id: string, dto: UpdateItemDto, actorId: string): Promise<Item> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Item not found');

    const data: Prisma.ItemUncheckedUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.published !== undefined) data.published = dto.published;
    if (dto.imageFileIds !== undefined) data.imageFileIds = dto.imageFileIds;

    // Re-slug only when the title actually changes, so a published URL does not
    // move under an editor who only touched the description.
    if (dto.title !== undefined && dto.title !== existing.title) {
      const slug = slugify(dto.title);
      const clash = await this.repo.findBySlug(slug);
      if (clash && clash.id !== id) {
        throw new ConflictException(`An item with the slug "${slug}" already exists`);
      }
      data.title = dto.title;
      data.slug = slug;
    }

    const item = await this.repo.update(id, data);

    await this.audit.record({
      actorId,
      action: 'items.update',
      entity: 'Item',
      entityId: id,
      meta: { changed: Object.keys(data) },
    });

    return item;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Item not found');

    await this.repo.softDelete(id);

    await this.audit.record({
      actorId,
      action: 'items.delete',
      entity: 'Item',
      entityId: id,
      meta: { title: existing.title },
    });
  }

  async findById(id: string): Promise<Item> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  /** Public read: a draft is indistinguishable from a missing item. */
  async findPublishedBySlug(slug: string): Promise<Item> {
    const item = await this.repo.findBySlug(slug);
    if (!item || !item.published) throw new NotFoundException('Item not found');
    return item;
  }

  /** Admin list — drafts included. */
  list(query: ListItemsQueryDto): Promise<PaginatedResult<Item>> {
    const where: Prisma.ItemWhereInput = { deletedAt: null };
    if (query.published !== undefined) where.published = query.published;
    return this.paginate(where, query);
  }

  /** Public list — published only, never negotiable via query params. */
  listPublished(query: ListItemsQueryDto): Promise<PaginatedResult<Item>> {
    return this.paginate({ deletedAt: null, published: true }, query);
  }

  private async paginate(
    where: Prisma.ItemWhereInput,
    query: ListItemsQueryDto,
  ): Promise<PaginatedResult<Item>> {
    if (query.q) {
      where.title = { contains: query.q, mode: 'insensitive' };
    }

    const { skip, take, page, limit } = getPaginationParams(query);
    const orderBy = buildOrderBy(query.sortBy, query.order, SORTABLE, 'createdAt');

    const [rows, total] = await Promise.all([
      this.repo.findMany(where, orderBy, skip, take),
      this.repo.count(where),
    ]);

    return buildPaginatedResult(rows, total, page, limit);
  }
}
