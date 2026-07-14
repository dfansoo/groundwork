import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let repo: any;
  let audit: any;
  let svc: ItemsService;

  const item = (over: Record<string, unknown> = {}) => ({
    id: 'i1',
    title: 'Hello World',
    slug: 'hello-world',
    description: null,
    published: false,
    imageFileIds: [],
    deletedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  });

  beforeEach(() => {
    repo = {
      create: jest.fn(async (data: any) => item(data)),
      update: jest.fn(async (_id: string, data: any) => item(data)),
      findById: jest.fn(async () => null),
      findBySlug: jest.fn(async () => null),
      findMany: jest.fn(async () => [] as any[]),
      count: jest.fn(async () => 0),
      softDelete: jest.fn(async () => undefined),
    };
    audit = { record: jest.fn(async () => undefined) };
    svc = new ItemsService(repo, audit);
  });

  describe('create', () => {
    it('derives the slug from the title', async () => {
      const created = await svc.create(
        { title: 'Hello World' } as any,
        'user-1',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'hello-world', title: 'Hello World' }),
      );
      expect(created.slug).toBe('hello-world');
    });

    it('records an audit entry naming the actor', async () => {
      await svc.create({ title: 'Hello World' } as any, 'user-1');

      expect(audit.record).toHaveBeenCalledWith({
        actorId: 'user-1',
        action: 'items.create',
        entity: 'Item',
        entityId: 'i1',
        meta: { title: 'Hello World' },
      });
    });

    // The lookup and the insert are two statements: two requests with the same
    // title can both pass the check and race. Losing that race must be a 409, not
    // a 500 with a Prisma stack trace attached.
    it('turns a lost insert race into a conflict, not a crash', async () => {
      repo.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['slug'] },
        }),
      );

      await expect(
        svc.create({ title: 'Hello World' } as any, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('does not swallow an unrelated database error', async () => {
      repo.create.mockRejectedValue(new Error('connection reset'));

      await expect(
        svc.create({ title: 'Hello World' } as any, 'user-1'),
      ).rejects.toThrow('connection reset');
    });

    it('rejects a duplicate slug', async () => {
      repo.findBySlug.mockResolvedValue(item());

      await expect(
        svc.create({ title: 'Hello World' } as any, 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s on an unknown id', async () => {
      await expect(
        svc.update('nope', { title: 'x' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-slugs when the title changes and audits the update', async () => {
      repo.findById.mockResolvedValue(item());

      await svc.update('i1', { title: 'Brave New World' } as any, 'user-1');

      expect(repo.update).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ slug: 'brave-new-world' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'items.update',
          entityId: 'i1',
          actorId: 'user-1',
        }),
      );
    });

    it('leaves the slug alone when the title is unchanged', async () => {
      repo.findById.mockResolvedValue(item());

      await svc.update('i1', { description: 'new copy' } as any, 'user-1');

      expect(repo.update.mock.calls[0][1]).not.toHaveProperty('slug');
    });
  });

  describe('remove', () => {
    it('soft-deletes and audits', async () => {
      repo.findById.mockResolvedValue(item());

      await svc.remove('i1', 'user-1');

      expect(repo.softDelete).toHaveBeenCalledWith('i1', expect.any(String));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'items.delete', entityId: 'i1' }),
      );
    });

    // The unique index on slug covers deleted rows too, while the collision check
    // does not look at them. Leaving the slug in place means the title can never
    // be used again — and the failure lands on the database as a 500, not a 409.
    it('retires the slug so the title can be used again', async () => {
      repo.findById.mockResolvedValue(item({ slug: 'hello-world' }));

      await svc.remove('i1', 'user-1');

      const [, freedSlug] = repo.softDelete.mock.calls[0];
      expect(freedSlug).not.toBe('hello-world');
      expect(freedSlug).toContain('hello-world');
      expect(freedSlug).toContain('i1');
    });

    it('404s on an unknown id', async () => {
      await expect(svc.remove('nope', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('public reads', () => {
    it('findPublishedBySlug 404s on a draft', async () => {
      repo.findBySlug.mockResolvedValue(item({ published: false }));

      await expect(svc.findPublishedBySlug('hello-world')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findPublishedBySlug returns a published item', async () => {
      repo.findBySlug.mockResolvedValue(item({ published: true }));

      await expect(
        svc.findPublishedBySlug('hello-world'),
      ).resolves.toMatchObject({
        slug: 'hello-world',
      });
    });

    it('listPublished only ever asks the repo for published rows', async () => {
      await svc.listPublished({ page: 1, limit: 20, order: 'desc' } as any);

      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ published: true, deletedAt: null }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('admin list', () => {
    it('returns drafts as well as published items', async () => {
      await svc.list({ page: 1, limit: 20, order: 'desc' } as any);

      const where = repo.findMany.mock.calls[0][0];
      expect(where).not.toHaveProperty('published');
      expect(where).toMatchObject({ deletedAt: null });
    });

    it('wraps rows in a paginated envelope', async () => {
      repo.findMany.mockResolvedValue([item()]);
      repo.count.mockResolvedValue(1);

      const res = await svc.list({ page: 1, limit: 20, order: 'desc' } as any);

      expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(res.items).toHaveLength(1);
    });
  });
});
