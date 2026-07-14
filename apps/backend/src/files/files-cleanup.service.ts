import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FilesRepository } from './files.repository';
import { StorageService } from './storage.service';
import { AuditService } from '../audit/audit.service';

export interface SweepResult {
  scanned: number;
  swept: number;
  sweptIds: string[];
}

@Injectable()
export class FilesCleanupService {
  private readonly logger = new Logger(FilesCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: FilesRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private ttlHours(): number {
    return this.config.get<number>('FILE_ORPHAN_TTL_HOURS', 24);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'sweep-orphan-file-assets' })
  async handleCron(): Promise<void> {
    const result = await this.sweepOrphans();
    this.logger.log(
      `Orphan file-asset sweep: scanned ${result.scanned}, swept ${result.swept}`,
    );
  }

  /**
   * Delete FileAssets that no live entity references and that are older than the
   * TTL. An asset is referenced when its id appears in a (non-deleted) Item's
   * `imageFileIds`. Covers both PENDING (upload started, never confirmed) and
   * READY (confirmed but never attached to a saved entity) assets. Idempotent.
   *
   * When you add a model that holds file ids, add it to referencedIds() below —
   * otherwise this sweep will happily delete assets that model is still using.
   */
  async sweepOrphans(): Promise<SweepResult> {
    const cutoff = new Date(Date.now() - this.ttlHours() * 60 * 60 * 1000);
    const candidates = await this.repo.findSweepCandidates(cutoff);
    if (candidates.length === 0) {
      return { scanned: 0, swept: 0, sweptIds: [] };
    }

    const candidateIds = candidates.map((c) => c.id);
    const referenced = await this.referencedIds(candidateIds);
    const orphans = candidates.filter((c) => !referenced.has(c.id));

    const sweptIds: string[] = [];
    for (const orphan of orphans) {
      try {
        await this.storage.deleteObject(orphan.key);
      } catch (err) {
        // A storage hiccup must not block the row cleanup; log and continue.
        this.logger.error(
          `Failed to delete storage object ${orphan.key} for orphan ${orphan.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      await this.repo.softDelete(orphan.id);
      await this.audit.record({
        action: 'files.sweep.orphan',
        entity: 'FileAsset',
        entityId: orphan.id,
        meta: { key: orphan.key, status: orphan.status },
      });
      sweptIds.push(orphan.id);
    }

    return { scanned: candidates.length, swept: sweptIds.length, sweptIds };
  }

  /** Ids among `candidateIds` still referenced by a live entity. */
  private async referencedIds(candidateIds: string[]): Promise<Set<string>> {
    const referenced = new Set<string>();
    const candidateSet = new Set(candidateIds);

    const items = await this.prisma.item.findMany({
      where: { deletedAt: null, imageFileIds: { hasSome: candidateIds } },
      select: { imageFileIds: true },
    });

    for (const item of items) {
      for (const id of item.imageFileIds) {
        if (candidateSet.has(id)) referenced.add(id);
      }
    }

    return referenced;
  }
}
