import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { AuditService } from '../audit/audit.service';
import { FaceMatchProvider } from './providers/face-match.provider';

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
    private auditService: AuditService,
    private faceMatchProvider: FaceMatchProvider,
  ) {}

  /**
   * Digital verification flow:
   * - Validate voter exists and hasn't voted
   * - Generate token
   * - Log audit entries
   */
  async digitalVerify(voterId: string, idType: string, idNumber: string) {
    const voter = await this.prisma.voter.findUnique({ where: { id: voterId } });
    if (!voter) throw new NotFoundException('Voter not found in electoral roll');
    if (voter.hasVoted) throw new BadRequestException('Voter has already voted');

    // Check for existing active token
    const existing = await this.tokensService.findActiveByVoterId(voterId);
    if (existing) throw new BadRequestException('Voter already has an active token');

    // Generate token
    const token = await this.tokensService.generate({
      voterId,
      verificationMode: 'digital',
      idType,
      idNumber,
    });

    // Log audit
    await this.auditService.log({
      terminal: 'digital',
      action: 'Digital verification completed & token generated',
      status: 'success',
      details: `Token: ${token.code}`,
      voterId,
    });

    return token;
  }

  /**
   * Manual verification flow:
   * - Validate voter exists and hasn't voted
   * - Validate officer exists with sufficient role
   * - Generate token with M- prefix
   * - Log audit entries
   */
  async manualVerify(
    voterId: string,
    idType: string,
    idNumber: string,
    reason: string,
    officerId: string,
  ) {
    const voter = await this.prisma.voter.findUnique({ where: { id: voterId } });
    if (!voter) throw new NotFoundException('Voter not found in electoral roll');
    if (voter.hasVoted) throw new BadRequestException('Voter has already voted');

    // Verify officer exists
    const officer = await this.prisma.officer.findUnique({ where: { officerId } });
    if (!officer) throw new NotFoundException('Officer not found');

    // Check for existing active token
    const existing = await this.tokensService.findActiveByVoterId(voterId);
    if (existing) throw new BadRequestException('Voter already has an active token');

    // Generate token
    const token = await this.tokensService.generate({
      voterId,
      verificationMode: 'manual',
      idType,
      idNumber,
    });

    // Log audit
    await this.auditService.log({
      terminal: 'manual',
      action: 'Manual verification approved & token generated',
      status: 'success',
      details: `Token: ${token.code}, Reason: ${reason}, Officer: ${officerId}`,
      voterId,
      officerId,
    });

    return token;
  }

  /**
   * Face match verification flow (Phase 1: Mockable / Phase 4: Internal Test)
   */
  async faceMatch(voterId: string, liveImage: string) {
    try {
      const voter = await this.prisma.voter.findUnique({ where: { id: voterId } });
      if (!voter) throw new NotFoundException('Voter not found in electoral roll');

      if (voter.faceVerificationEnabled === false) {
        throw new BadRequestException('Face verification is disabled for this voter record');
      }

      if (!voter.photoUrl) {
        throw new BadRequestException('Voter record is missing a reference photo');
      }

      console.log(`[DEBUG] Calling faceMatchProvider for voter: ${voterId}`);
      const result = await this.faceMatchProvider.matchFace(liveImage, voterId);

      // Audit log the attempt
      await this.auditService.log({
        terminal: 'digital',
        action: 'Facial verification attempt',
        status: result.matchStatus === 'MATCH' ? 'success' : 'failure',
        details: `Status: ${result.matchStatus}, Confidence: ${result.confidenceScore}, Reason: ${result.reason}, Provider: ${result.providerId}`,
        voterId,
      });

      return result;
    } catch (error: any) {
      const fs = require('fs');
      const errorMsg = `[${new Date().toISOString()}] FaceMatch Error for ${voterId}:\n${error.message}\n${error.stack}\n\n`;
      fs.appendFileSync('debug_error.txt', errorMsg);
      console.error('[ERROR] VerificationService.faceMatch failed:', error);
      throw error;
    }
  }
}
