import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { Role } from '../../types/role.enum';

export class UpdateStaffRolesDto {
  @ApiProperty({ enum: Role, isArray: true, example: [Role.ADMIN] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  roles: Role[];
}
