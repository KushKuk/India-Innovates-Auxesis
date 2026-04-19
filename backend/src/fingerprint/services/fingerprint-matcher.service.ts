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

// Local Structure Parameters
const NEIGHBOR_COUNT = 3;      // Number of neighbors to form a local star/triplet
const DIST_TOLERANCE = 8;      // Distance tolerance for local structures
const ANGLE_TOLERANCE = 0.25;  // Angular tolerance for local structures

interface LocalStructure {
  center: Minutia;
  neighbors: {
    dist: number;      // Distance to neighbor
    relAngle: number;  // Angle of neighbor relative to center's ridge angle
    type: string;      // Neighbor type
  }[];
}

@Injectable()
export class FingerprintMatcherService {
  private readonly logger = new Logger(FingerprintMatcherService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly extractor: FingerprintExtractorService,
  ) {}

  async matchBest(
    probeBuffer: Buffer,
    enrolled: TemplateRecord[],
  ): Promise<MatchResult> {
    const threshold = parseFloat(
      this.config.get<string>('FINGERPRINT_MATCH_THRESHOLD') ?? '30',
    );

    if (enrolled.length === 0) {
      return {
        matched: false, score: 0, threshold, matchedTemplateId: null,
        failureReason: FailureReason.NO_ENROLLED_TEMPLATES,
      };
    }

    const encKey = this.config.getOrThrow<string>('FINGERPRINT_ENCRYPTION_KEY');
    const probe = this.extractor.deserialize(probeBuffer);
    const probeStructures = this.buildLocalStructures(probe.minutiae);

    let bestScore = 0;
    let bestId: string | null = null;
    let bestMatchCount = 0;

    for (const record of enrolled) {
      try {
        const plain = decryptTemplate(record.templateData, record.iv, encKey);
        const candidate = this.extractor.deserialize(plain);
        const candidateStructures = this.buildLocalStructures(candidate.minutiae);

        // Perform Triplet-based matching
        const { score, matches } = this.matchLocalStructures(probeStructures, candidateStructures);

        this.logger.debug(
          `Template Match - ID: ${record.id.substring(0, 8)} | Score: ${score.toFixed(1)} | Triplets: ${matches} | Threshold: ${threshold}`,
        );

        if (score > bestScore) {
          bestScore = score;
          bestId = record.id;
          bestMatchCount = matches;
        }
      } catch (err: any) {
        this.logger.warn(`Skipping template ${record.id}: ${err?.message}`);
      }
    }

    // Since Triplets are much harder to match, we lower the count required to 4
    const MIN_REQUIRED_TRIPLETS = 4;
    const isSignificant = bestMatchCount >= MIN_REQUIRED_TRIPLETS;
    const matched = isSignificant && bestScore >= threshold;

    this.logger.log(
      `Biometric Result: ${matched ? 'SUCCESS' : 'FAILURE'} | Best Score: ${bestScore.toFixed(1)} | Strong Matches: ${bestMatchCount} | Threshold: ${threshold}`,
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
   * For every minutia, find its nearest neighbors to create a 'Local Star' descriptor.
   */
  private buildLocalStructures(minutiae: Minutia[]): LocalStructure[] {
    return minutiae.map(m1 => {
      // Find nearest neighbors
      const neighbors = minutiae
        .filter(m2 => m1 !== m2)
        .map(m2 => ({
          dist: Math.hypot(m1.x - m2.x, m1.y - m2.y),
          angle: Math.atan2(m2.y - m1.y, m2.x - m1.x),
          type: m2.type,
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, NEIGHBOR_COUNT)
        .map(n => ({
          dist: n.dist,
          relAngle: this.angleDiff(n.angle, m1.angle),
          type: n.type,
        }));

      return { center: m1, neighbors };
    });
  }

  /**
   * Compare neighborhoods and enforce a SINGLE global geometric transformation.
   */
  private matchLocalStructures(
    probe: LocalStructure[],
    candidate: LocalStructure[],
  ): { score: number; matches: number } {
    // Stage 1: Store potential matches and their required transformations
    const potentialMatches: { dx: number; dy: number; dTheta: number; pIdx: number; cIdx: number }[] = [];

    for (let pi = 0; pi < probe.length; pi++) {
      const p = probe[pi];
      for (let ci = 0; ci < candidate.length; ci++) {
        const c = candidate[ci];

        if (p.center.type !== c.center.type) continue;

        let neighborMatches = 0;
        const usedCNeighborIdxs = new Set<number>();
        for (const pn of p.neighbors) {
          for (let cni = 0; cni < c.neighbors.length; cni++) {
            if (usedCNeighborIdxs.has(cni)) continue;
            const cn = c.neighbors[cni];

            if (pn.type !== cn.type) continue;
            if (Math.abs(pn.dist - cn.dist) > DIST_TOLERANCE) continue;
            if (Math.abs(this.angleDiff(pn.relAngle, cn.relAngle)) > ANGLE_TOLERANCE) continue;

            neighborMatches++;
            usedCNeighborIdxs.add(cni);
            break;
          }
        }

        // Potential Match found!
        if (neighborMatches >= 2) {
          potentialMatches.push({
            dx: c.center.x - p.center.x,
            dy: c.center.y - p.center.y,
            dTheta: this.angleDiff(c.center.angle, p.center.angle),
            pIdx: pi,
            cIdx: ci,
          });
        }
      }
    }

    // Stage 2: Geometric Consensus (Binning)
    // We look for a group of matches that share the same global (dx, dy, dTheta)
    const binSizePos = 15; // px
    const binSizeAngle = 0.5; // rad
    
    let bestConsensusCount = 0;
    
    // We try each potential match as a "consensing anchor"
    for (const anchor of potentialMatches) {
      let currentConsensus = 0;
      const matchedP = new Set<number>();
      const matchedC = new Set<number>();

      for (const m of potentialMatches) {
        if (matchedP.has(m.pIdx) || matchedC.has(m.cIdx)) continue;

        const dxErr = Math.abs(m.dx - anchor.dx);
        const dyErr = Math.abs(m.dy - anchor.dy);
        const dThetaErr = Math.abs(this.angleDiff(m.dTheta, anchor.dTheta));

        if (dxErr <= binSizePos && dyErr <= binSizePos && dThetaErr <= binSizeAngle) {
          currentConsensus++;
          matchedP.add(m.pIdx);
          matchedC.add(m.cIdx);
        }
      }

      if (currentConsensus > bestConsensusCount) {
        bestConsensusCount = currentConsensus;
      }
    }

    const minSetSize = Math.min(probe.length, candidate.length);
    const score = minSetSize > 0 ? (bestConsensusCount / minSetSize) * 100 : 0;
    return { score, matches: bestConsensusCount };
  }

  /** Compute shortest angular difference [-π, π] */
  private angleDiff(a: number, b: number): number {
    let diff = a - b;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }
}

