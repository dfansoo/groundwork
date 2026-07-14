import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { FILE_KINDS } from '../files.constants';

export class CreateUploadDto {
  @ApiProperty({ enum: ['public', 'private'], example: 'public' })
  @IsIn(['public', 'private'])
  visibility: 'public' | 'private';

  @ApiProperty({
    example: 'item',
    description: 'Logical group: item|avatar|banner|document|misc',
    enum: FILE_KINDS,
  })
  @IsString()
  @MaxLength(40)
  @IsIn(FILE_KINDS as unknown as string[])
  kind: string;

  @ApiProperty({ example: 'galle-front.jpg' })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType: string;
}
