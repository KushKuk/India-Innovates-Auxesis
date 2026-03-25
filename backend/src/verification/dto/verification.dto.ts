import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DigitalVerifyDto {
  @ApiProperty({ example: 'uuid-of-voter' })
  @IsString()
  voterId: string;

  @ApiProperty({ example: 'aadhaar', description: 'ID type used for verification' })
  @IsString()
  idType: string;

  @ApiProperty({ example: 'IDABCDEFG', description: 'Scanned ID number' })
  @IsString()
  idNumber: string;
}

export class ManualVerifyDto {
  @ApiProperty({ example: 'uuid-of-voter' })
  @IsString()
  voterId: string;

  @ApiProperty({ example: 'voter_id' })
  @IsString()
  idType: string;

  @ApiProperty({ example: 'VOT001' })
  @IsString()
  idNumber: string;

  @ApiProperty({ example: 'aadhaar_not_available' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'EO001' })
  @IsString()
  officerId: string;

  @ApiPropertyOptional({ example: 'Supervisor verified identity in person' })
  @IsOptional()
  @IsString()
  supervisorNotes?: string;
}
