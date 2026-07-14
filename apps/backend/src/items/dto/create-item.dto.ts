import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'My first item' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'A longer description of the item.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'FileAsset ids from POST /v1/admin/files/uploads',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageFileIds?: string[];
}
