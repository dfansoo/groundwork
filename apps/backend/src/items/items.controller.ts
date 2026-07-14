import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../types/permission.enum';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/** Public catalogue. No auth — published items only. */
@ApiTags('items')
@Controller({ path: 'items', version: '1' })
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List published items' })
  @ApiResponse({ status: 200, description: 'A page of published items.' })
  list(@Query() query: ListItemsQueryDto) {
    return this.items.listPublished(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get one published item by slug' })
  @ApiResponse({ status: 200, description: 'The item.' })
  @ApiResponse({ status: 404, description: 'No published item with that slug.' })
  findOne(@Param('slug') slug: string) {
    return this.items.findPublishedBySlug(slug);
  }
}

/** Admin CRUD. Reads need ITEMS_READ; every mutation needs ITEMS_WRITE. */
@ApiTags('admin/items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'admin/items', version: '1' })
export class AdminItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @RequirePermissions(Permission.ITEMS_READ)
  @ApiOperation({ summary: 'List items, drafts included' })
  list(@Query() query: ListItemsQueryDto) {
    return this.items.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ITEMS_READ)
  @ApiOperation({ summary: 'Get one item by id, draft or published' })
  findOne(@Param('id') id: string) {
    return this.items.findById(id);
  }

  @Post()
  @RequirePermissions(Permission.ITEMS_WRITE)
  @ApiOperation({ summary: 'Create an item' })
  @ApiResponse({ status: 201, description: 'Item created.' })
  @ApiResponse({ status: 409, description: 'An item with that slug already exists.' })
  create(
    @Body() dto: CreateItemDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.items.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ITEMS_WRITE)
  @ApiOperation({ summary: 'Update an item' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.items.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ITEMS_WRITE)
  @ApiOperation({ summary: 'Soft-delete an item' })
  @ApiResponse({ status: 204, description: 'Item deleted.' })
  remove(@Param('id') id: string, @Request() req: { user: AuthenticatedUser }) {
    return this.items.remove(id, req.user.id);
  }
}
