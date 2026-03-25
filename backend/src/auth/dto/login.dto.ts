import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'EO001' })
  @IsString()
  officerId: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
