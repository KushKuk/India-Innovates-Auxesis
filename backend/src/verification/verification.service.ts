import { Injectable, BadRequestException, NotFoundException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { AuditService } from '../audit/audit.service';
import { FaceMatchProvider } from './providers/face-match.provider';
import { decodeQr } from './utils/qr-utils';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
    private auditService: AuditService,
    private faceMatchProvider: FaceMatchProvider,
    private encryptionService: EncryptionService, // Inject EncryptionService
  ) {}

  /**
   * Digital verification flow:
   * - Validate voter exists and hasn't voted
   * - Generate token
   * - Log audit entries
   */
  async digitalVerify(voterId: string, idType: string, idNumber: string) {
    const voter = await this.prisma.client.voter.findUnique({ where: { id: voterId } });
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
    const voter = await this.prisma.client.voter.findUnique({ where: { id: voterId } });
    if (!voter) throw new NotFoundException('Voter not found in electoral roll');
    if (voter.hasVoted) throw new BadRequestException('Voter has already voted');

    // Verify officer exists
    const officer = await this.prisma.client.officer.findUnique({ where: { officerId } });
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
      const voter = await this.prisma.client.voter.findUnique({ where: { id: voterId } });
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

  /**
   * QR Scanning Flow
   * - Decodes Base64 QR
   * - Searches by Aadhaar, PAN, or Voter ID
   * - Returns simplified user profile
   */
  async scanQr(qrString: string) {
    try {
      console.log(`[QR-SCAN] Received Encrypted QR payload...`);
      
      let decrypted: string;

      if (qrString.startsWith('v2:')) {
        decrypted = this.encryptionService.decrypt(qrString);
        // If decryption failed or returned same string, it's invalid
        if (decrypted === qrString || !decrypted.includes('|')) {
          throw new BadRequestException('Security Violation: Decryption failed or invalid key usage.');
        }
      } else {
        // Fallback for Demo: Allow plain-text if it contains the pipe separator
        if (qrString.includes('|')) {
          console.warn(`[QR-SCAN] Plain-text QR detected. Using fallback for demo.`);
          decrypted = qrString;
        } else {
          throw new BadRequestException('Invalid QR format. Use Type|ID or encrypted v2: format.');
        }
      }

      const [type, rawId] = decrypted.split('|');
      const scannedId = String(rawId?.trim());
      console.log(`[QR-SCAN] Diagnostic: Type=${type}, scannedId="${scannedId}"`);

      let voter: any = null;

      try {
        if (type === 'AADHAR' || type === 'PAN') {
          const idHash = this.encryptionService.generateBlindIndex(scannedId);
          const searchDocType = type === 'AADHAR' ? 'Aadh' : 'PAN';
          console.log(`[QR-SCAN] Searching for hash: ${idHash}`);

          voter = await this.prisma.base.voter.findFirst({
            where: {
              documents: {
                some: {
                  documentNumberHash: idHash,
                  documentTypeName: { contains: searchDocType, mode: 'insensitive' }
                }
              }
            },
            select: { id: true, name: true } // SAFE MODE: Only fetch basic fields
          });
        } else if (type === 'VOTER') {
          console.log(`[QR-SCAN] Running findFirst on: ${scannedId}`);
          voter = await this.prisma.base.voter.findFirst({ 
            where: { id: scannedId },
            select: { id: true, name: true } // SAFE MODE: Only fetch basic fields
          });
          
          if (!voter) {
            const idHash = this.encryptionService.generateBlindIndex(scannedId);
            voter = await this.prisma.base.voter.findFirst({
              where: {
                documents: {
                  some: {
                    documentNumberHash: idHash,
                    documentTypeName: { contains: 'Voter', mode: 'insensitive' }
                  }
                }
              },
              select: { id: true, name: true } // SAFE MODE: Only fetch basic fields
            });
          }
        }
      } catch (err) {
        console.error(`[QR-SCAN] SAFE-MODE-FAIL:`, err);
        throw err;
      }

      if (voter) {
        console.log(`[QR-SCAN] Found voter! Decrypting name...`);
        if (voter.name && voter.name.startsWith('v2:')) {
           voter.name = this.encryptionService.decrypt(voter.name);
        }
      }

      if (!voter) {
        throw new BadRequestException(`Unsupported identity type: ${type}`);
      }

      if (!voter) {
        throw new NotFoundException(`Voter not found with ID: ${scannedId}`);
      }

      return {
        id: voter.id,
        name: voter.name,
        photoUrl: voter.photoUrl,
        documentType: type,
        status: voter.votingStatus,
        hasVoted: voter.hasVoted,
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      
      // LOG ERROR FOR DIAGNOSIS
      const fs = require('fs');
      const errorMsg = `[${new Date().toISOString()}] ScanQr Error:\n${e.message}\n${e.stack}\n\n`;
      fs.appendFileSync('debug_error.txt', errorMsg);
      
      console.error('[ERROR] VerificationService.scanQr failed:', e);
      throw new InternalServerErrorException(e.message);
    }
  }
}
