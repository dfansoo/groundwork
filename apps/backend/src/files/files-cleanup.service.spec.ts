import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { FilesCleanupService } from './files-cleanup.service';

describe('FilesCleanupService', () => {
  let prisma: any;
  let repo: any;
  let storage: any;
  let audit: any;
  let config: any;
  let svc: FilesCleanupService;

  const asset = (id: string) => ({
    id,
    key: `public/item/${id}.jpg`,
    status: 'READY',
    createdAt: new Date(0),
  });

  beforeEach(() => {
    prisma = {
      item: { findMany: jest.fn(async () => [] as any[]) },
    };
    repo = {
      findSweepCandidates: jest.fn(async () => [] as any[]),
      softDelete: jest.fn(async () => undefined),
    };
    storage = { deleteObject: jest.fn(async () => undefined) };
    audit = { record: jest.fn(async () => undefined) };
    config = { get: jest.fn(() => 24) };
    svc = new FilesCleanupService(prisma, repo, storage, audit, config);
  });

  it('sweeps an unreferenced, aged asset and spares an item-referenced one', async () => {
    repo.findSweepCandidates.mockResolvedValue([asset('a'), asset('b')]);
    prisma.item.findMany.mockResolvedValue([{ imageFileIds: ['b', 'other'] }]);

    const res = await svc.sweepOrphans();

    expect(res).toEqual({ scanned: 2, swept: 1, sweptIds: ['a'] });
    expect(storage.deleteObject).toHaveBeenCalledWith('public/item/a.jpg');
    expect(storage.deleteObject).not.toHaveBeenCalledWith('public/item/b.jpg');
    expect(repo.softDelete).toHaveBeenCalledWith('a');
    expect(repo.softDelete).not.toHaveBeenCalledWith('b');
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('only counts references from live items, not soft-deleted ones', async () => {
    repo.findSweepCandidates.mockResolvedValue([asset('a')]);
    prisma.item.findMany.mockResolvedValue([]);

    const res = await svc.sweepOrphans();

    expect(res.swept).toBe(1);
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('no-ops when there are no candidates (skips cross-entity queries)', async () => {
    const res = await svc.sweepOrphans();

    expect(res).toEqual({ scanned: 0, swept: 0, sweptIds: [] });
    expect(prisma.item.findMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('soft-deletes the row even when storage deletion fails', async () => {
    repo.findSweepCandidates.mockResolvedValue([asset('x')]);
    storage.deleteObject.mockRejectedValue(new Error('storage down'));

    const res = await svc.sweepOrphans();

    expect(res.swept).toBe(1);
    expect(repo.softDelete).toHaveBeenCalledWith('x');
  });

  it('derives the cutoff from the configured TTL', async () => {
    config.get.mockReturnValue(48);
    await svc.sweepOrphans();

    const cutoff = repo.findSweepCandidates.mock.calls[0][0] as Date;
    const hoursAgo = (Date.now() - cutoff.getTime()) / 3_600_000;
    expect(hoursAgo).toBeGreaterThan(47.9);
    expect(hoursAgo).toBeLessThan(48.1);
  });
});
