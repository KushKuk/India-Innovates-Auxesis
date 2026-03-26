import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FingerLabel } from '../fingerprint.constants';

export class EnrollFingerprintDto {
  @IsString()
  voterId: string;

  @IsEnum(FingerLabel)
  fingerLabel: FingerLabel;

  /** Optional image path to store for audit trail */
  @IsOptional()
  @IsString()
  imageRef?: string;

  /** Optional device identifier for the scanner */
  @IsOptional()
  @IsString()
  deviceId?: string;
}
