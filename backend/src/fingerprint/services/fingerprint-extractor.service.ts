import { Injectable, Logger } from '@nestjs/common';
import { FailureReason, EXTRACTOR_USED, TEMPLATE_VERSION } from '../fingerprint.constants';

// ─── Minutia types ────────────────────────────────────────────────────────────
export interface Minutia {
  x: number;
  y: number;
  angle: number;   // radians, ridge direction
  type: 'ending' | 'bifurcation';
}

export interface FingerprintDescriptor {
  minutiae: Minutia[];
  version: string;
}

export interface ExtractionResult {
  success: true;
  template: Buffer;          // JSON-serialized + encrypted descriptor
  extractorUsed: string;
  templateVersion: string;
}

export interface ExtractionFailure {
  success: false;
  failureReason: FailureReason;
  message: string;
}

export type ExtractionOutput = ExtractionResult | ExtractionFailure;

// Threshold for binarization (0-255 grayscale)
const BINARIZE_THRESHOLD = 128;
// Minimum minutiae count for a usable template
const MIN_MINUTIAE = 12;

@Injectable()
export class FingerprintExtractorService {
  private readonly logger = new Logger(FingerprintExtractorService.name);

  /**
   * Extract a fingerprint template from a preprocessed grayscale PNG buffer.
   * Uses the Crossing Number (CN) algorithm:
   *   CN = 1 → ridge ending
   *   CN = 3 → bifurcation
   *
   * Returns a JSON-serialized descriptor as a Buffer, ready for encryption.
   */
  async extract(processedBuffer: Buffer): Promise<ExtractionOutput> {
    try {
      const { Jimp } = require('jimp');
      const img = await Jimp.read(processedBuffer);
      img.grayscale();

      const { width, height } = img.bitmap;

      // ── Step 1: Binarize (black = ridge, white = valley) ─────────────────
      const binary = this.binarize(img, width, height);

      // ── Step 2: Thin ridges (Zhang-Suen thinning approximation) ──────────
      const thinned = this.thin(binary, width, height);

      // ── Step 3: Extract minutiae via Crossing Number ──────────────────────
      const minutiae = this.extractMinutiae(thinned, width, height);

      if (minutiae.length < MIN_MINUTIAE) {
        return {
          success: false,
          failureReason: FailureReason.TEMPLATE_EXTRACTION_FAILED,
          message: `Too few minutiae detected (${minutiae.length}). Minimum required: ${MIN_MINUTIAE}.`,
        };
      }

      // ── Step 4: Serialize descriptor to Buffer ────────────────────────────
      const descriptor: FingerprintDescriptor = {
        minutiae,
        version: TEMPLATE_VERSION,
      };
      const serialized = Buffer.from(JSON.stringify(descriptor), 'utf8');

      this.logger.log(
        `Extracted ${minutiae.length} minutiae | size: ${width}x${height}`,
      );

      return {
        success: true,
        template: serialized,
        extractorUsed: EXTRACTOR_USED,
        templateVersion: TEMPLATE_VERSION,
      };
    } catch (err: any) {
      this.logger.error(`Template extraction failed: ${err?.message}`);
      return {
        success: false,
        failureReason: FailureReason.TEMPLATE_EXTRACTION_FAILED,
        message: err?.message ?? 'Unknown extraction error',
      };
    }
  }

  /** Deserialize a decrypted template Buffer back into a FingerprintDescriptor */
  deserialize(templateBuffer: Buffer): FingerprintDescriptor {
    return JSON.parse(templateBuffer.toString('utf8')) as FingerprintDescriptor;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Produce a flat Uint8Array: 0 = ridge, 255 = valley */
  private binarize(img: any, width: number, height: number): Uint8Array {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = img.bitmap.data[idx];
        out[y * width + x] = gray < BINARIZE_THRESHOLD ? 0 : 255;
      }
    }
    return out;
  }

  /**
   * Simplified Zhang-Suen thinning (2-pass per iteration).
   * Iterates until convergence (no more pixels removed). 
   */
  private thin(binary: Uint8Array, width: number, height: number): Uint8Array {
    const grid = new Uint8Array(binary); // 0 = ridge, 255 = background
    let changed = true;

    // Helper: get pixel value (1 = ridge, 0 = background) with border clamp
    const get = (x: number, y: number): number => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return grid[y * width + x] === 0 ? 1 : 0;
    };

    const countNonZeroNeighbours = (x: number, y: number): number => {
      const n = [get(x,y-1),get(x+1,y-1),get(x+1,y),get(x+1,y+1),
                 get(x,y+1),get(x-1,y+1),get(x-1,y),get(x-1,y-1)];
      return n.reduce((a, b) => a + b, 0);
    };

    const countTransitions = (x: number, y: number): number => {
      const n = [get(x,y-1),get(x+1,y-1),get(x+1,y),get(x+1,y+1),
                 get(x,y+1),get(x-1,y+1),get(x-1,y),get(x-1,y-1),get(x,y-1)];
      let t = 0;
      for (let i = 0; i < 8; i++) if (n[i] === 0 && n[i+1] === 1) t++;
      return t;
    };

    let iters = 0;
    while (changed && iters++ < 30) {
      changed = false;
      const toRemove = new Set<number>();

      // Pass 1
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (get(x, y) !== 1) continue;
          const B = countNonZeroNeighbours(x, y);
          if (B < 2 || B > 6) continue;
          if (countTransitions(x, y) !== 1) continue;
          if (get(x,y-1)*get(x+1,y)*get(x,y+1) !== 0) continue;
          if (get(x+1,y)*get(x,y+1)*get(x-1,y) !== 0) continue;
          toRemove.add(y * width + x);
        }
      }
      toRemove.forEach(i => { grid[i] = 255; changed = true; });
      if (!changed) break;
      const toRemove2 = new Set<number>();

      // Pass 2
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (get(x, y) !== 1) continue;
          const B = countNonZeroNeighbours(x, y);
          if (B < 2 || B > 6) continue;
          if (countTransitions(x, y) !== 1) continue;
          if (get(x,y-1)*get(x+1,y)*get(x-1,y) !== 0) continue;
          if (get(x,y-1)*get(x,y+1)*get(x-1,y) !== 0) continue;
          toRemove2.add(y * width + x);
        }
      }
      toRemove2.forEach(i => { grid[i] = 255; changed = true; });
    }

    return grid;
  }

  /**
   * Extract minutiae using the Crossing Number (CN) method on a thinned binary image.
   *   CN = sum of |P_i - P_{i+1}| / 2 for 8-neighbours
   *   CN == 1 → ridge ending
   *   CN == 3 → bifurcation
   */
  private extractMinutiae(
    thinned: Uint8Array,
    width: number,
    height: number,
  ): Minutia[] {
    const minutiae: Minutia[] = [];

    const get = (x: number, y: number): number => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return thinned[y * width + x] === 0 ? 1 : 0;
    };

    const crossingNumber = (x: number, y: number): number => {
      const n = [get(x,y-1),get(x+1,y-1),get(x+1,y),get(x+1,y+1),
                 get(x,y+1),get(x-1,y+1),get(x-1,y),get(x-1,y-1)];
      let cn = 0;
      for (let i = 0; i < 8; i++) {
        cn += Math.abs(n[i] - n[(i + 1) % 8]);
      }
      return cn / 2;
    };

    // Estimate local ridge direction from gradient
    const ridgeAngle = (x: number, y: number): number => {
      const dx = get(x + 1, y) - get(x - 1, y);
      const dy = get(x, y + 1) - get(x, y - 1);
      return Math.atan2(dy, dx);
    };

    // Skip border pixels to avoid edge artifacts
    const border = 10;
    for (let y = border; y < height - border; y++) {
      for (let x = border; x < width - border; x++) {
        if (get(x, y) !== 1) continue;
        const cn = crossingNumber(x, y);
        if (cn === 1 || cn === 3) {
          minutiae.push({
            x,
            y,
            angle: ridgeAngle(x, y),
            type: cn === 1 ? 'ending' : 'bifurcation',
          });
        }
      }
    }

    // Deduplicate: remove minutiae closer than 8 pixels to each other
    return this.deduplicateMinutiae(minutiae, 8);
  }

  private deduplicateMinutiae(minutiae: Minutia[], minDist: number): Minutia[] {
    const kept: Minutia[] = [];
    for (const m of minutiae) {
      const tooClose = kept.some(
        k => Math.hypot(k.x - m.x, k.y - m.y) < minDist,
      );
      if (!tooClose) kept.push(m);
    }
    return kept;
  }
}
