import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditDto {
  @ApiProperty({ example: 'digital', enum: ['digital', 'manual', 'tvo'] })
  @IsString()
  terminal: string;

  @ApiProperty({ example: 'ID verified' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'success', enum: ['info', 'success', 'error', 'warning'] })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'Identity document verified' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ example: 'uuid-of-voter' })
  @IsOptional()
  @IsString()
  voterId?: string;

  @ApiPropertyOptional({ example: 'EO001' })
  @IsOptional()
  @IsString()
  officerId?: string;
}
