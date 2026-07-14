import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FilesController } from './files.controller';
import { FilesLocalController } from './files-local.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';
import { FilesRepository } from './files.repository';
import { StorageService } from './storage.service';

// The local upload/serve endpoint only exists to stand in for S3 in development.
// Registering it conditionally means it cannot be reached at all in production.
const isLocalStorage = (process.env.FILES_DRIVER ?? 'local') !== 's3';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: isLocalStorage
    ? [FilesController, FilesLocalController]
    : [FilesController],
  providers: [FilesService, FilesCleanupService, FilesRepository, StorageService],
  exports: [FilesService, StorageService],
})
export class FilesModule {}
