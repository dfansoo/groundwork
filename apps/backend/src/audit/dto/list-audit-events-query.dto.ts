import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../types/role.enum';

export class ListAuditEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Inclusive lower bound on createdAt (ISO-8601 date or datetime)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on createdAt; a date-only value covers the whole day' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: Role, description: "Filter to events by an actor who currently holds this role" })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
