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
   * No timer starts yet - token is just created and waiting for TVO verification
   */
  async generate(data: {
    voterId: string;
    verificationMode: 'digital' | 'manual';
    idType: string;
    idNumber: string;
  }) {
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
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours - no timer yet
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
        data: { hasVoted: true, votingStatus: 'VOTED' },
      });
    }

    return updated;
  }

  /**
   * TVO verifies token - marks it as IN_PROGRESS
   * This sets a 3-minute window for the voter to actually vote
   */
  async verifyToken(tokenId: string) {
    const token = await this.prisma.token.findUnique({ 
      where: { id: tokenId },
      include: { voter: true },
    });
    
    if (!token) throw new NotFoundException('Token not found');
    if (token.votingStatus !== 'TOKEN_ACTIVE') {
      throw new Error(`Token is ${token.votingStatus}, cannot verify`);
    }

    const inProgressExpiryMinutes = 3; // 3-minute window for voting

    // Update token status
    const updatedToken = await this.prisma.token.update({
      where: { id: tokenId },
      data: {
        votingStatus: 'IN_PROGRESS',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + inProgressExpiryMinutes * 60 * 1000),
      },
      include: { voter: true },
    });

    // Update voter status
    await this.prisma.voter.update({
      where: { id: token.voterId },
      data: { votingStatus: 'IN_PROGRESS' },
    });

    return updatedToken;
  }

  /**
   * TVO approves voting - marks token and voter as VOTED
   * 3-MINUTE TIMER STARTS HERE - voter must actually vote within 3 minutes
   * If 3 minutes expire without confirmation, hasVoted reverts to false
   */
  async approveVoting(tokenId: string) {
    const token = await this.prisma.token.findUnique({
      where: { id: tokenId },
      include: { voter: true },
    });

    if (!token) throw new NotFoundException('Token not found');
    if (token.votingStatus !== 'IN_PROGRESS') {
      throw new Error(`Token must be IN_PROGRESS to approve, current: ${token.votingStatus}`);
    }

    // START 3-MINUTE TIMER HERE
    const votingTimeoutMinutes = 3;

    // Update token status with 3-minute expiry
    const updatedToken = await this.prisma.token.update({
      where: { id: tokenId },
      data: {
        votingStatus: 'VOTED',
        confirmedAt: new Date(),
        expiresAt: new Date(Date.now() + votingTimeoutMinutes * 60 * 1000), // 3-min timer starts now
      },
      include: { voter: true },
    });

    // Mark voter as having voted (but can be reverted if timer expires)
    await this.prisma.voter.update({
      where: { id: token.voterId },
      data: { votingStatus: 'VOTED', hasVoted: true },
    });

    return updatedToken;
  }

  /**
   * Check for expired IN_PROGRESS and VOTED tokens and revert them
   * Run this periodically (e.g., every minute) to handle timeouts
   */
  async checkAndExpireInProgressTokens() {
    const now = new Date();

    // Find all IN_PROGRESS tokens that have expired
    const expiredInProgressTokens = await this.prisma.token.findMany({
      where: {
        votingStatus: 'IN_PROGRESS',
        expiresAt: { lte: now },
      },
      include: { voter: true },
    });

    // Find all VOTED tokens that have expired (3-min timer exceeded)
    const expiredVotedTokens = await this.prisma.token.findMany({
      where: {
        votingStatus: 'VOTED',
        expiresAt: { lte: now },
      },
      include: { voter: true },
    });

    const allExpiredTokens = [...expiredInProgressTokens, ...expiredVotedTokens];

    // Revert each expired token
    for (const token of allExpiredTokens) {
      // Mark token as expired
      await this.prisma.token.update({
        where: { id: token.id },
        data: { votingStatus: 'EXPIRED' },
      });

      // Revert voter status to PENDING and hasVoted to false
      await this.prisma.voter.update({
        where: { id: token.voterId },
        data: { votingStatus: 'PENDING', hasVoted: false },
      });
    }

    return allExpiredTokens.length;
  }

  /**
   * Get token expiration status
   */
  async getTokenStatus(tokenId: string) {
    const token = await this.prisma.token.findUnique({
      where: { id: tokenId },
      include: { voter: true },
    });

    if (!token) {
      return { status: 'NOT_FOUND', remainingTime: null };
    }

    const now = new Date();
    const remainingMs = token.expiresAt.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    return {
      status: token.votingStatus,
      remainingTime: remainingSeconds,
      voter: token.voter,
    };
  }
}
