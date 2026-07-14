import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FilesService } from './files.service';

describe('FilesService', () => {
  let repo: any;
  let storage: any;
  let audit: any;
  let svc: FilesService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      markReady: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      softDelete: jest.fn(),
      findManyByIds: jest.fn(),
    };
    storage = {
      bucketName: 'test-bucket',
      presignPut: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        url: 'https://s3/put',
        expiresAt: new Date(Date.now() + 300000),
      }),
      headObject: jest.fn(),
      deleteObject: jest
        .fn<(...args: any[]) => any>()
        .mockResolvedValue(undefined),
      publicUrl: jest.fn((k: string) => `https://cdn/${k}`),
      signPrivateUrl: jest.fn((k: string) => `https://cdn/${k}?sig=1`),
    };
    audit = {
      record: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    };
    svc = new FilesService(repo, storage, audit);
  });

  describe('createUpload', () => {
    it('rejects a disallowed content type', async () => {
      await expect(
        svc.createUpload(
          {
            visibility: 'public',
            kind: 'item',
            filename: 'x.gif',
            contentType: 'image/gif',
          },
          'admin1',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a PENDING asset and returns a presigned URL', async () => {
      repo.create.mockResolvedValue({ id: 'asset1' });
      const res = await svc.createUpload(
        {
          visibility: 'public',
          kind: 'item',
          filename: 'x.jpg',
          contentType: 'image/jpeg',
        },
        'admin1',
      );
      expect(res.assetId).toBe('asset1');
      expect(res.uploadUrl).toBe('https://s3/put');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'test-bucket',
          visibility: 'public',
          status: 'PENDING',
          kind: 'item',
          mimeType: 'image/jpeg',
          originalName: 'x.jpg',
          uploadedById: 'admin1',
        }),
      );
      expect(repo.create.mock.calls[0][0].key).toMatch(
        /^public\/item\/[0-9a-f-]+\.jpg$/,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'files.upload.init',
          entity: 'FileAsset',
        }),
      );
    });
  });

  describe('confirm', () => {
    it('throws NotFound for an unknown asset', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.confirm('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws Conflict when the object is missing', async () => {
      repo.findById.mockResolvedValue({
        id: 'a1',
        key: 'public/item/a.jpg',
        kind: 'item',
        visibility: 'public',
      });
      storage.headObject.mockResolvedValue(null);
      await expect(svc.confirm('a1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('deletes and rejects an oversized upload', async () => {
      repo.findById.mockResolvedValue({
        id: 'a1',
        key: 'public/item/a.jpg',
        kind: 'item',
        visibility: 'public',
      });
      storage.headObject.mockResolvedValue({
        contentLength: 999_999_999,
        contentType: 'image/jpeg',
      });
      await expect(svc.confirm('a1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(storage.deleteObject).toHaveBeenCalledWith('public/item/a.jpg');
      expect(repo.markReady).not.toHaveBeenCalled();
    });

    it('marks READY and sets a public URL', async () => {
      repo.findById.mockResolvedValue({
        id: 'a1',
        key: 'public/item/a.jpg',
        kind: 'item',
        visibility: 'public',
      });
      storage.headObject.mockResolvedValue({
        contentLength: 1000,
        contentType: 'image/jpeg',
      });
      repo.markReady.mockResolvedValue({ id: 'a1', status: 'READY' });
      await svc.confirm('a1', 'admin1');
      expect(repo.markReady).toHaveBeenCalledWith('a1', {
        sizeBytes: 1000,
        mimeType: 'image/jpeg',
        url: 'https://cdn/public/item/a.jpg',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'files.upload.confirm',
          entity: 'FileAsset',
        }),
      );
    });

    it('leaves url null for private assets', async () => {
      repo.findById.mockResolvedValue({
        id: 'a2',
        key: 'private/document/a.pdf',
        kind: 'document',
        visibility: 'private',
      });
      storage.headObject.mockResolvedValue({
        contentLength: 1000,
        contentType: 'application/pdf',
      });
      repo.markReady.mockResolvedValue({ id: 'a2', status: 'READY' });
      await svc.confirm('a2');
      expect(repo.markReady).toHaveBeenCalledWith(
        'a2',
        expect.objectContaining({ url: null }),
      );
    });
  });

  describe('getWithUrl', () => {
    it('signs private assets', async () => {
      repo.findById.mockResolvedValue({
        id: 'a2',
        key: 'private/document/a.pdf',
        visibility: 'private',
        url: null,
      });
      const res = await svc.getWithUrl('a2');
      expect(res.accessUrl).toBe('https://cdn/private/document/a.pdf?sig=1');
    });

    it('returns the stored URL for public assets', async () => {
      repo.findById.mockResolvedValue({
        id: 'a1',
        key: 'public/item/a.jpg',
        visibility: 'public',
        url: 'https://cdn/public/item/a.jpg',
      });
      const res = await svc.getWithUrl('a1');
      expect(res.accessUrl).toBe('https://cdn/public/item/a.jpg');
    });
  });

  describe('remove', () => {
    it('is idempotent for an unknown asset', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.remove('nope')).resolves.toEqual({ deleted: true });
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('deletes the object and soft-deletes the row', async () => {
      repo.findById.mockResolvedValue({ id: 'a1', key: 'public/item/a.jpg' });
      await svc.remove('a1', 'admin1');
      expect(storage.deleteObject).toHaveBeenCalledWith('public/item/a.jpg');
      expect(repo.softDelete).toHaveBeenCalledWith('a1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'files.delete',
          entity: 'FileAsset',
        }),
      );
    });
  });

  describe('list', () => {
    it('builds a where clause from the provided filters and returns a paginated result', async () => {
      const fakeAssets = [
        { id: 'a1', kind: 'item', visibility: 'public', status: 'READY' },
        { id: 'a2', kind: 'item', visibility: 'public', status: 'READY' },
      ];
      repo.findMany.mockResolvedValue(fakeAssets);
      repo.count.mockResolvedValue(2);

      const res = await svc.list({
        page: 1,
        limit: 20,
        kind: 'item',
        visibility: 'public',
        status: 'READY',
      } as any);

      const expectedWhere = expect.objectContaining({
        kind: 'item',
        visibility: 'public',
        status: 'READY',
      });
      expect(repo.findMany).toHaveBeenCalledWith(expectedWhere, 0, 20);
      expect(repo.count).toHaveBeenCalledWith(expectedWhere);
      expect(res.items).toEqual(fakeAssets);
      expect(res.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    });

    it('omits filter keys entirely when none are provided', async () => {
      repo.findMany.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await svc.list({ page: 1, limit: 20 } as any);

      const emptyWhere = expect.not.objectContaining({
        kind: expect.anything(),
        visibility: expect.anything(),
        status: expect.anything(),
      });
      expect(repo.findMany).toHaveBeenCalledWith(emptyWhere, 0, 20);
      expect(repo.count).toHaveBeenCalledWith(emptyWhere);
    });
  });

  describe('getManyWithUrls', () => {
    it('returns [] for empty input without hitting the repo', async () => {
      const res = await svc.getManyWithUrls([]);
      expect(res).toEqual([]);
      expect(repo.findManyByIds).not.toHaveBeenCalled();
    });

    it('resolves ids to access URLs, preserving input order', async () => {
      repo.findManyByIds.mockResolvedValue([
        {
          id: 'a2',
          key: 'public/item/2.jpg',
          visibility: 'public',
          url: 'https://cdn/2.jpg',
        },
        {
          id: 'a1',
          key: 'public/item/1.jpg',
          visibility: 'public',
          url: 'https://cdn/1.jpg',
        },
      ]);
      const res = await svc.getManyWithUrls(['a1', 'a2']);
      expect(res.map((a) => a.id)).toEqual(['a1', 'a2']);
      expect(res[0].accessUrl).toBe('https://cdn/1.jpg');
    });

    it('skips ids the repo does not return (missing or not READY)', async () => {
      repo.findManyByIds.mockResolvedValue([
        {
          id: 'a1',
          key: 'public/item/1.jpg',
          visibility: 'public',
          url: 'https://cdn/1.jpg',
        },
      ]);
      const res = await svc.getManyWithUrls(['a1', 'missing']);
      expect(res.map((a) => a.id)).toEqual(['a1']);
    });
  });
});
