import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptTemplate } from '../utils/crypto.util';
import {
  FingerprintExtractorService,
  FingerprintDescriptor,
  Minutia,
} from './fingerprint-extractor.service';
import { FailureReason } from '../fingerprint.constants';

export interface TemplateRecord {
  id: string;
  templateData: Buffer;
  iv: string;
}

export interface MatchResult {
  matched: boolean;
  score: number;
  threshold: number;
  matchedTemplateId: string | null;
  failureReason?: FailureReason;
}

// How many best-matching minutia pairs to count for the score
const TOP_K_PAIRS = 12;
// Max distance (px) and angle difference (rad) for a pair to be considered a match
const MAX_DIST = 20;
const MAX_ANGLE_DIFF = 0.35; // ~20 degrees

@Injectable()
export class FingerprintMatcherService {
  private readonly logger = new Logger(FingerprintMatcherService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly extractor: FingerprintExtractorService,
  ) {}

  /**
   * Match a probe template against all enrolled templates for a voter+finger.
   * Uses spatial minutiae pair matching:
   *   Score = number of corresponding minutiae pairs (similar position + angle)
   *           normalized 0–100.
   *
   * Best score across all enrolled templates is used as the final result.
   */
  async matchBest(
    probeBuffer: Buffer,
    enrolled: TemplateRecord[],
  ): Promise<MatchResult> {
    const threshold = parseFloat(
      this.config.get<string>('FINGERPRINT_MATCH_THRESHOLD') ?? '40',
    );

    if (enrolled.length === 0) {
      return {
        matched: false,
        score: 0,
        threshold,
        matchedTemplateId: null,
        failureReason: FailureReason.NO_ENROLLED_TEMPLATES,
      };
    }

    const encKey = this.config.getOrThrow<string>('FINGERPRINT_ENCRYPTION_KEY');

    // Deserialize probe
    const probe = this.extractor.deserialize(probeBuffer);

    let bestScore = 0;
    let bestId: string | null = null;

    for (const record of enrolled) {
      try {
        const plain = decryptTemplate(record.templateData, record.iv, encKey);
        const candidate = this.extractor.deserialize(plain);

        const score = this.spatialMinutiaeScore(probe, candidate);

        this.logger.debug(
          `Template ${record.id}: score=${score.toFixed(1)} threshold=${threshold}`,
        );

        if (score > bestScore) {
          bestScore = score;
          bestId = record.id;
        }
      } catch (err: any) {
        this.logger.warn(`Skipping template ${record.id}: ${err?.message}`);
      }
    }

    const matched = bestScore >= threshold;

    this.logger.log(
      `Match: ${matched ? 'MATCH ✓' : 'NO_MATCH ✗'} | score=${bestScore.toFixed(1)} | threshold=${threshold}`,
    );

    return {
      matched,
      score: parseFloat(bestScore.toFixed(2)),
      threshold,
      matchedTemplateId: matched ? bestId : null,
      failureReason: matched ? undefined : FailureReason.MATCH_SCORE_BELOW_THRESHOLD,
    };
  }

  /**
   * Spatial minutiae matching score (0–100).
   *
   * For each probe minutia, find the nearest candidate minutia within
   * MAX_DIST pixels and MAX_ANGLE_DIFF radians. Count the matched pairs,
   * take the top TOP_K_PAIRS and normalize to 100.
   *
   * This is a simplified (but effective) implementation of the MCC-like
   * matching used by SourceAFIS conceptually.
   */
  private spatialMinutiaeScore(
    probe: FingerprintDescriptor,
    candidate: FingerprintDescriptor,
  ): number {
    let matches = 0;
    const usedCandidateIdxs = new Set<number>();

    for (const pm of probe.minutiae) {
      let bestCIdx = -1;
      let bestCDist = Infinity;

      for (let ci = 0; ci < candidate.minutiae.length; ci++) {
        if (usedCandidateIdxs.has(ci)) continue;
        const cm = candidate.minutiae[ci];

        const dist = Math.hypot(pm.x - cm.x, pm.y - cm.y);
        if (dist > MAX_DIST) continue;

        const angleDiff = Math.abs(this.angleDiff(pm.angle, cm.angle));
        if (angleDiff > MAX_ANGLE_DIFF) continue;

        if (dist < bestCDist) {
          bestCDist = dist;
          bestCIdx = ci;
        }
      }

      if (bestCIdx >= 0) {
        matches++;
        usedCandidateIdxs.add(bestCIdx);
        if (matches >= TOP_K_PAIRS) break;
      }
    }

    // Normalize: TOP_K_PAIRS matches → 100 score
    return Math.min(100, (matches / TOP_K_PAIRS) * 100);
  }

  /** Compute shortest angular difference in radians (signed, [-π, π]) */
  private angleDiff(a: number, b: number): number {
    let diff = a - b;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }
}
