import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
    private auditService: AuditService,
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
}
