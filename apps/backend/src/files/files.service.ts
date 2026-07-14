import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileAsset, Prisma } from '@prisma/client';
import { FilesRepository } from './files.repository';
import { StorageService } from './storage.service';
import { AuditService } from '../audit/audit.service';
import {
  PaginatedResult,
  buildPaginatedResult,
  getPaginationParams,
} from '../common/pagination';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import {
  allowedContentTypes,
  extForContentType,
  maxBytesForKind,
} from './files.constants';

export interface UploadTicket {
  assetId: string;
  key: string;
  uploadUrl: string;
  expiresAt: Date;
}

export type FileAssetWithUrl = FileAsset & { accessUrl: string };

@Injectable()
export class FilesService {
  constructor(
    private readonly repo: FilesRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async createUpload(
    dto: CreateUploadDto,
    actorId?: string,
  ): Promise<UploadTicket> {
    if (!allowedContentTypes(dto.kind).includes(dto.contentType)) {
      throw new UnprocessableEntityException(
        `Content type ${dto.contentType} is not allowed for kind ${dto.kind}`,
      );
    }
    const key = `${dto.visibility}/${dto.kind}/${randomUUID()}${extForContentType(dto.contentType)}`;

    const asset = await this.repo.create({
      bucket: this.storage.bucketName,
      key,
      visibility: dto.visibility,
      status: 'PENDING',
      kind: dto.kind,
      originalName: dto.filename,
      mimeType: dto.contentType,
      uploadedById: actorId ?? null,
    });

    const { url, expiresAt } = await this.storage.presignPut(
      key,
      dto.contentType,
    );
    await this.audit.record({
      actorId,
      action: 'files.upload.init',
      entity: 'FileAsset',
      entityId: asset.id,
      meta: { key, visibility: dto.visibility, kind: dto.kind },
    });
    return { assetId: asset.id, key, uploadUrl: url, expiresAt };
  }

  async confirm(id: string, actorId?: string): Promise<FileAsset> {
    const asset = await this.repo.findById(id);
    if (!asset) throw new NotFoundException('File asset not found');

    const head = await this.storage.headObject(asset.key);
    if (!head)
      throw new ConflictException('Uploaded object not found in storage');

    const maxBytes = maxBytesForKind(asset.kind);
    if (head.contentLength > maxBytes) {
      await this.storage.deleteObject(asset.key);
      throw new UnprocessableEntityException(
        `File exceeds the ${maxBytes} byte limit for kind ${asset.kind}`,
      );
    }

    const url =
      asset.visibility === 'public' ? this.storage.publicUrl(asset.key) : null;
    const ready = await this.repo.markReady(id, {
      sizeBytes: head.contentLength,
      mimeType: head.contentType,
      url,
    });
    await this.audit.record({
      actorId,
      action: 'files.upload.confirm',
      entity: 'FileAsset',
      entityId: id,
      meta: { sizeBytes: head.contentLength },
    });
    return ready;
  }

  async getWithUrl(id: string): Promise<FileAssetWithUrl> {
    const asset = await this.repo.findById(id);
    if (!asset) throw new NotFoundException('File asset not found');
    const accessUrl =
      asset.visibility === 'public'
        ? (asset.url ?? this.storage.publicUrl(asset.key))
        : this.storage.signPrivateUrl(asset.key);
    return { ...asset, accessUrl };
  }

  async getManyWithUrls(ids: string[]): Promise<FileAssetWithUrl[]> {
    if (ids.length === 0) return [];
    const assets = await this.repo.findManyByIds(ids);
    const byId = new Map(assets.map((a) => [a.id, a]));
    const result: FileAssetWithUrl[] = [];
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset) continue; // lenient: skip missing / not-READY ids
      const accessUrl =
        asset.visibility === 'public'
          ? (asset.url ?? this.storage.publicUrl(asset.key))
          : this.storage.signPrivateUrl(asset.key);
      result.push({ ...asset, accessUrl });
    }
    return result;
  }

  async list(query: ListFilesQueryDto): Promise<PaginatedResult<FileAsset>> {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Prisma.FileAssetWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.visibility) where.visibility = query.visibility;
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.repo.findMany(where, skip, take),
      this.repo.count(where),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async remove(id: string, actorId?: string): Promise<{ deleted: true }> {
    const asset = await this.repo.findById(id);
    if (!asset) return { deleted: true }; // idempotent
    await this.storage.deleteObject(asset.key);
    await this.repo.softDelete(id);
    await this.audit.record({
      actorId,
      action: 'files.delete',
      entity: 'FileAsset',
      entityId: id,
      meta: { key: asset.key },
    });
    return { deleted: true };
  }
}
