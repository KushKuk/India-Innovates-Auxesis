import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { FingerprintPreprocessorService } from './services/fingerprint-preprocessor.service';
import { FingerprintExtractorService } from './services/fingerprint-extractor.service';
import { FingerprintMatcherService } from './services/fingerprint-matcher.service';
import { FingerprintLogService } from './services/fingerprint-log.service';
import { encryptTemplate } from './utils/crypto.util';
import {
  VerificationStatus,
  FailureReason,
  EXTRACTOR_USED,
  TEMPLATE_VERSION,
} from './fingerprint.constants';
import { EnrollFingerprintDto } from './dto/enroll-fingerprint.dto';
import { VerifyFingerprintDto } from './dto/verify-fingerprint.dto';

@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preprocessor: FingerprintPreprocessorService,
    private readonly extractor: FingerprintExtractorService,
    private readonly matcher: FingerprintMatcherService,
    private readonly logService: FingerprintLogService,
    private readonly config: ConfigService,
  ) {}

  // ─── ENROLL ──────────────────────────────────────────────────────────────

  /**
   * Enroll a fingerprint image for a voter.
   * Pipeline: validate voter → preprocess → extract → encrypt → store
   */
  async enroll(
    imageBuffer: Buffer,
    mimeType: string,
    dto: EnrollFingerprintDto,
  ) {
    const sessionId = uuidv4();

    // Validate voter exists
    const voter = await this.prisma.client.voter.findUnique({
      where: { id: dto.voterId },
    });
    if (!voter) {
      throw new NotFoundException(`Voter not found: ${dto.voterId}`);
    }

    // ── Step 1: Preprocess ──────────────────────────────────────────────
    const preprocessed = await this.preprocessor.preprocess(imageBuffer, mimeType);
    if (!preprocessed.success) {
      this.logger.warn(`Enrollment rejected — ${preprocessed.failureReason}: ${preprocessed.message}`);
      throw new BadRequestException({
        failureReason: preprocessed.failureReason,
        qualityScore: preprocessed.qualityScore,
        message: preprocessed.message,
      });
    }

    // ── Step 2: Extract template ────────────────────────────────────────
    const extracted = await this.extractor.extract(preprocessed.processedBuffer);
    if (!extracted.success) {
      throw new BadRequestException({
        failureReason: extracted.failureReason,
        message: extracted.message,
      });
    }

    // ── Step 3: Encrypt & store ─────────────────────────────────────────
    const encKey = this.config.getOrThrow<string>('FINGERPRINT_ENCRYPTION_KEY');
    const { ciphertext, iv } = encryptTemplate(extracted.template, encKey);

    const stored = await this.prisma.client.fingerprintTemplate.create({
      data: {
        voterId: dto.voterId,
        fingerLabel: dto.fingerLabel,
        templateType: EXTRACTOR_USED,
        templateData: Buffer.from(ciphertext),
        iv,
        qualityScore: preprocessed.qualityScore,
        imageRef: dto.imageRef ?? null,
        templateVersion: TEMPLATE_VERSION,
        active: true,
      },
    });

    this.logger.log(
      `Enrolled fingerprint for voter ${dto.voterId} (${dto.fingerLabel}) — template ID: ${stored.id}`,
    );

    return {
      success: true,
      templateId: stored.id,
      fingerLabel: dto.fingerLabel,
      qualityScore: preprocessed.qualityScore,
      templateVersion: TEMPLATE_VERSION,
      sessionId,
    };
  }

  // ─── VERIFY ───────────────────────────────────────────────────────────────

  /**
   * Verify a live fingerprint scan against all enrolled templates for the voter.
   * Pipeline: preprocess → extract → decrypt all enrolled → match best → log
   */
  async verify(
    imageBuffer: Buffer,
    mimeType: string,
    dto: VerifyFingerprintDto,
  ) {
    const threshold = parseFloat(
      this.config.get<string>('FINGERPRINT_MATCH_THRESHOLD') ?? '40',
    );
    const inputFormat = mimeType.includes('png') ? 'png' : 'jpg';

    // ── Step 1: Preprocess ──────────────────────────────────────────────
    const preprocessed = await this.preprocessor.preprocess(imageBuffer, mimeType);
    if (!preprocessed.success) {
      await this.logService.log({
        sessionId: dto.sessionId,
        voterId: dto.voterId,
        fingerLabel: dto.fingerLabel,
        status: VerificationStatus.FAILED,
        qualityScore: preprocessed.qualityScore,
        threshold,
        failureReason: preprocessed.failureReason,
        extractorUsed: EXTRACTOR_USED,
        inputFormat,
        templateVersion: TEMPLATE_VERSION,
        deviceId: dto.deviceId,
      });
      return {
        matched: false,
        score: 0,
        threshold,
        qualityScore: preprocessed.qualityScore,
        failureReason: preprocessed.failureReason,
        message: preprocessed.message,
      };
    }

    // ── Step 2: Extract probe template ──────────────────────────────────
    const extracted = await this.extractor.extract(preprocessed.processedBuffer);
    if (!extracted.success) {
      await this.logService.log({
        sessionId: dto.sessionId,
        voterId: dto.voterId,
        fingerLabel: dto.fingerLabel,
        status: VerificationStatus.FAILED,
        qualityScore: preprocessed.qualityScore,
        threshold,
        failureReason: extracted.failureReason,
        extractorUsed: EXTRACTOR_USED,
        inputFormat,
        templateVersion: TEMPLATE_VERSION,
        deviceId: dto.deviceId,
      });
      return {
        matched: false,
        score: 0,
        threshold,
        qualityScore: preprocessed.qualityScore,
        failureReason: extracted.failureReason,
      };
    }

    // ── Step 3: Load all active enrolled templates ────────────────────────
    const enrolledRecords = await this.prisma.client.fingerprintTemplate.findMany({
      where: { voterId: dto.voterId, fingerLabel: dto.fingerLabel, active: true },
    });

    // ── Step 4: Match best ────────────────────────────────────────────────
    const matchResult = await this.matcher.matchBest(
      extracted.template,
      enrolledRecords.map((r) => ({
        id: r.id,
        templateData: Buffer.from(r.templateData),
        iv: r.iv,
      })),
    );

    // ── Step 5: Log everything ────────────────────────────────────────────
    await this.logService.log({
      sessionId: dto.sessionId,
      voterId: dto.voterId,
      fingerLabel: dto.fingerLabel,
      status: matchResult.matched ? VerificationStatus.SUCCESS : VerificationStatus.FAILED,
      qualityScore: preprocessed.qualityScore,
      matchScore: matchResult.score,
      threshold: matchResult.threshold,
      failureReason: matchResult.failureReason,
      extractorUsed: EXTRACTOR_USED,
      matchedTemplateId: matchResult.matchedTemplateId ?? undefined,
      inputFormat,
      templateVersion: TEMPLATE_VERSION,
      deviceId: dto.deviceId,
    });

    return {
      matched: matchResult.matched,
      score: matchResult.score,
      threshold: matchResult.threshold,
      qualityScore: preprocessed.qualityScore,
      matchedTemplateId: matchResult.matchedTemplateId,
      failureReason: matchResult.failureReason ?? null,
    };
  }

  // ─── LOGS ─────────────────────────────────────────────────────────────────

  async getLogs(sessionId: string) {
    const logs = await this.logService.getBySession(sessionId);
    if (!logs.length) {
      throw new NotFoundException(`No logs found for session: ${sessionId}`);
    }
    return logs;
  }
}
