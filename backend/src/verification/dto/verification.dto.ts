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
export class FaceMatchDto {
  @ApiProperty({ example: 'uuid-of-voter' })
  @IsString()
  voterId: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,...',
    description: 'Base64 encoded live capture image',
  })
  @IsString()
  liveImage: string;
}

export class FaceMatchResponse {
  @ApiProperty({ example: 'MATCH', enum: ['MATCH', 'NO_MATCH', 'ERROR'] })
  matchStatus: 'MATCH' | 'NO_MATCH' | 'ERROR';

  @ApiProperty({ example: 0.98, description: 'Confidence score (0 to 1)' })
  confidenceScore: number;

  @ApiPropertyOptional({ example: 'Face detected and matched successfully' })
  reason?: string;

  @ApiPropertyOptional({ example: 'mock-provider-v1' })
  providerId?: string;
}

export class ScanQrDto {
  @ApiProperty({
    example: 'QUFESEFSfDk4NzY1NDMyMTIzNA==',
    description: 'Base64 encoded string: TYPE|ID',
  })
  @IsString()
  qrString: string;
}
