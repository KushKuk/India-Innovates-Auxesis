import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationStatus } from '../fingerprint.constants';

export interface CreateLogParams {
  sessionId: string;
  voterId: string;
  fingerLabel: string;
  status: VerificationStatus;
  qualityScore?: number;
  matchScore?: number;
  threshold: number;
  failureReason?: string;
  extractorUsed: string;
  matchedTemplateId?: string;
  inputFormat?: string;
  templateVersion?: string;
  deviceId?: string;
}

@Injectable()
export class FingerprintLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write a full audit log entry for every fingerprint attempt.
   * Called by both enroll and verify flows regardless of outcome.
   */
  async log(params: CreateLogParams) {
    return this.prisma.client.fingerprintLog.create({
      data: {
        sessionId: params.sessionId,
        voterId: params.voterId,
        fingerLabel: params.fingerLabel,
        status: params.status,
        qualityScore: params.qualityScore ?? null,
        matchScore: params.matchScore ?? null,
        threshold: params.threshold,
        failureReason: params.failureReason ?? null,
        extractorUsed: params.extractorUsed,
        matchedTemplateId: params.matchedTemplateId ?? null,
        inputFormat: params.inputFormat ?? null,
        templateVersion: params.templateVersion ?? null,
        deviceId: params.deviceId ?? null,
      },
    });
  }

  /** Retrieve all logs for a given sessionId */
  async getBySession(sessionId: string) {
    return this.prisma.client.fingerprintLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
