import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffRolesDto } from './dto/update-staff-roles.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../types/permission.enum';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'admin/staff', version: '1' })
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @RequirePermissions(Permission.STAFF_WRITE)
  @ApiOperation({ summary: 'Create an internal staff member' })
  create(
    @Body() dto: CreateStaffDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.staffService.create(dto, req.user.id);
  }

  @Get()
  @RequirePermissions(Permission.STAFF_READ)
  @ApiOperation({ summary: 'List internal staff (paginated, searchable, role-filterable)' })
  list(@Query() query: ListStaffQueryDto) {
    return this.staffService.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_READ)
  @ApiOperation({ summary: 'Get one staff member' })
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id/roles')
  @RequirePermissions(Permission.STAFF_WRITE)
  @ApiOperation({ summary: 'Replace a staff member roles' })
  replaceRoles(
    @Param('id') id: string,
    @Body() dto: UpdateStaffRolesDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.staffService.replaceRoles(id, dto.roles, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.STAFF_WRITE)
  @ApiOperation({ summary: 'Deactivate a staff member' })
  deactivate(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.staffService.deactivate(id, req.user.id);
  }
}
