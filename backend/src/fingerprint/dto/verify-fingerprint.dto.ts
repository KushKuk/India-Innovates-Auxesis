import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FingerLabel } from '../fingerprint.constants';

export class VerifyFingerprintDto {
  @IsString()
  voterId: string;

  @IsEnum(FingerLabel)
  fingerLabel: FingerLabel;

  /** Session ID for linking log entries across the verification flow */
  @IsString()
  sessionId: string;

  /** Optional device identifier for the scanner */
  @IsOptional()
  @IsString()
  deviceId?: string;
}
