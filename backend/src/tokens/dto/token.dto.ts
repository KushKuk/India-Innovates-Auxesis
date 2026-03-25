import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateTokenDto {
  @ApiPropertyOptional({ example: 'VTR123ABC' })
  @IsOptional()
  @IsString()
  voterId?: string;

  @ApiPropertyOptional({ example: 'aadhaar' })
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiPropertyOptional({ example: 'XXXX1234' })
  @IsOptional()
  @IsString()
  idNumber?: string;
}

export class UpdateTokenStatusDto {
  @ApiProperty({ example: 'IN_PROGRESS', enum: ['IN_PROGRESS', 'VOTED', 'EXPIRED', 'NOT_VOTED'] })
  @IsString()
  status: string;
}
