import { Controller, Get, Header, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService, AuditEventView } from './audit.service';
import { ListAuditEventsQueryDto } from './dto/list-audit-events-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../types/permission.enum';
import { PaginatedResult } from '../common/pagination';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'admin/audit-events', version: '1' })
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'List audit events (paginated; filter by date range + actor role)' })
  list(@Query() query: ListAuditEventsQueryDto): Promise<PaginatedResult<AuditEventView>> {
    return this.audit.list(query);
  }

  @Get('export.csv')
  @RequirePermissions(Permission.AUDIT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-events.csv"')
  @ApiOperation({ summary: 'Export filtered audit events as CSV (max 5000 rows)' })
  async export(@Query() query: ListAuditEventsQueryDto): Promise<StreamableFile> {
    const csv = await this.audit.exportCsv(query);
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
