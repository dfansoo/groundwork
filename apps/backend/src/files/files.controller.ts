import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../types/permission.enum';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('files-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'admin/files', version: '1' })
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly filesCleanup: FilesCleanupService,
  ) {}

  @Post('uploads')
  @RequirePermissions(Permission.ASSETS_WRITE)
  @ApiOperation({ summary: 'Create a presigned upload' })
  createUpload(
    @Body() dto: CreateUploadDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.filesService.createUpload(dto, req.user.id);
  }

  @Post('sweep-orphans')
  @RequirePermissions(Permission.ASSETS_WRITE)
  @ApiOperation({
    summary: 'Sweep orphaned (unreferenced) file assets older than the TTL',
  })
  sweepOrphans() {
    return this.filesCleanup.sweepOrphans();
  }

  @Post(':id/confirm')
  @RequirePermissions(Permission.ASSETS_WRITE)
  @ApiOperation({ summary: 'Confirm an upload (verify + finalize)' })
  confirm(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.filesService.confirm(id, req.user.id);
  }

  @Get()
  @RequirePermissions(Permission.ASSETS_READ)
  @ApiOperation({ summary: 'List file assets (paginated)' })
  list(@Query() query: ListFilesQueryDto) {
    return this.filesService.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ASSETS_READ)
  @ApiOperation({ summary: 'Get a file asset with an access URL' })
  findOne(@Param('id') id: string) {
    return this.filesService.getWithUrl(id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ASSETS_WRITE)
  @ApiOperation({ summary: 'Soft-delete a file asset' })
  remove(@Param('id') id: string, @Request() req: { user: AuthenticatedUser }) {
    return this.filesService.remove(id, req.user.id);
  }
}
