import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { FilesRepository } from './files.repository';

describe('FilesRepository', () => {
  const fileAsset = {
    create: jest.fn<(args: unknown) => Promise<unknown>>(),
    findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    update: jest.fn<(args: unknown) => Promise<unknown>>(),
    findMany: jest.fn<(args: unknown) => Promise<unknown>>(),
    count: jest.fn<(args: unknown) => Promise<unknown>>(),
  };
  const prisma = { fileAsset } as any;
  const repo = new FilesRepository(prisma);

  afterEach(() => jest.clearAllMocks());

  it('findById filters out soft-deleted rows', async () => {
    fileAsset.findFirst.mockResolvedValue(null);
    await repo.findById('id1');
    expect(fileAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'id1', deletedAt: null },
    });
  });

  it('markReady sets status READY with metadata', async () => {
    fileAsset.update.mockResolvedValue({});
    await repo.markReady('id1', { sizeBytes: 10, mimeType: 'image/png', url: null });
    expect(fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'id1' },
      data: { sizeBytes: 10, mimeType: 'image/png', url: null, status: 'READY' },
    });
  });

  it('findMany injects deletedAt: null into the where clause', async () => {
    fileAsset.findMany.mockResolvedValue([]);
    await repo.findMany({ kind: 'item' }, 0, 20);
    expect(fileAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: 'item', deletedAt: null } }),
    );
  });

  it('softDelete sets deletedAt', async () => {
    fileAsset.update.mockResolvedValue({});
    await repo.softDelete('id1');
    expect(fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'id1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('findManyByIds queries READY, non-deleted rows by id', async () => {
    fileAsset.findMany.mockResolvedValue([]);
    await repo.findManyByIds(['a1', 'a2']);
    expect(fileAsset.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1', 'a2'] }, deletedAt: null, status: 'READY' },
    });
  });

  it('findManyByIds short-circuits on empty input', async () => {
    await repo.findManyByIds([]);
    expect(fileAsset.findMany).not.toHaveBeenCalled();
  });
});
