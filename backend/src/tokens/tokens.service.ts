import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokensService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Generate a 6-character alphanumeric token code
   */
  private generateCode(prefix = ''): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return prefix ? `${prefix}-${code}` : code;
  }

  /**
   * Create a new token for a verified voter
   */
  async generate(data: {
    voterId: string;
    verificationMode: 'digital' | 'manual';
    idType: string;
    idNumber: string;
  }) {
    const expiryMinutes = this.config.get<number>('TOKEN_EXPIRY_MINUTES', 3);
    const prefix = data.verificationMode === 'manual' ? 'M' : '';
    const code = this.generateCode(prefix);

    return this.prisma.token.create({
      data: {
        code,
        voterId: data.voterId,
        verificationMode: data.verificationMode,
        idType: data.idType,
        idNumber: data.idNumber,
        votingStatus: 'TOKEN_ACTIVE',
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      },
      include: { voter: true },
    });
  }

  /**
   * Find an active (non-expired) token by voter ID
   */
  async findActiveByVoterId(voterId: string) {
    return this.prisma.token.findFirst({
      where: {
        voter: {
          id: voterId,
        },
        votingStatus: 'TOKEN_ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { voter: true },
    });
  }

  /**
   * Validate/lookup an active token by voterId or idType+idNumber
   */
  async validate(voterId?: string, idType?: string, idNumber?: string) {
    if (voterId) {
      // Search by voter ID — match any token whose voter id matches
      return this.prisma.token.findFirst({
        where: {
          voter: { id: voterId },
          votingStatus: 'TOKEN_ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { voter: true },
      });
    }

    if (idType && idNumber) {
      return this.prisma.token.findFirst({
        where: {
          idType,
          idNumber: { equals: idNumber, mode: 'insensitive' },
          votingStatus: 'TOKEN_ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { voter: true },
      });
    }

    return null;
  }

  /**
   * Get all active tokens
   */
  async findAllActive() {
    return this.prisma.token.findMany({
      where: {
        votingStatus: 'TOKEN_ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { voter: true },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /**
   * Update token voting status
   */
  async updateStatus(id: string, status: string) {
    const token = await this.prisma.token.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token not found');

    const data: any = { votingStatus: status };
    if (status === 'VOTED') {
      data.confirmedAt = new Date();
    }

    const updated = await this.prisma.token.update({
      where: { id },
      data,
      include: { voter: true },
    });

    // If voted, also mark the voter
    if (status === 'VOTED') {
      await this.prisma.voter.update({
        where: { id: token.voterId },
        data: { hasVoted: true },
      });
    }

    return updated;
  }
}
