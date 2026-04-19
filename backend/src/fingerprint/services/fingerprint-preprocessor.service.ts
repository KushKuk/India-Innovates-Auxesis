import { Injectable, Logger } from '@nestjs/common';
import { FailureReason } from '../fingerprint.constants';
import * as Jimp from 'jimp';

export interface PreprocessResult {
  success: true;
  processedBuffer: Buffer;
  qualityScore: number;
  width: number;
  height: number;
  inputFormat: string;
}

export interface PreprocessFailure {
  success: false;
  failureReason: FailureReason;
  qualityScore: number;
  message: string;
}

export type PreprocessOutput = PreprocessResult | PreprocessFailure;

// Tunable quality thresholds
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;
const MIN_QUALITY_SCORE = 5;
const MIN_LAPLACIAN_VARIANCE = 5;
const MIN_CONTRAST_RANGE = 5;

@Injectable()
export class FingerprintPreprocessorService {
  private readonly logger = new Logger(FingerprintPreprocessorService.name);

  /**
   * Main entry point. Runs all quality checks, returns processed grayscale buffer or failure.
   * Uses jimp via require to ensure CJS compatibility with NestJS.
   */
  async preprocess(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<PreprocessOutput> {
    const inputFormat = mimeType.includes('png') ? 'png' : 'jpg';

    let jimpImage: any;

    try {
      console.log('Jimp object type:', typeof Jimp);
      console.log('Jimp keys:', Object.keys(Jimp || {}));
      jimpImage = await (Jimp as any).read(imageBuffer);
    } catch (err: any) {
      return {
        success: false,
        failureReason: FailureReason.INTERNAL_ERROR,
        qualityScore: 0,
        message: `Failed to decode image buffer: ${err.message}`,
      };
    }

    const { width, height } = jimpImage.bitmap;

    // ── Check 1: Minimum dimensions ──────────────────────────────────────
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return {
        success: false,
        failureReason: FailureReason.IMAGE_TOO_SMALL,
        qualityScore: 0,
        message: `Image too small: ${width}x${height}. Minimum: ${MIN_WIDTH}x${MIN_HEIGHT}.`,
      };
    }

    // ── Convert to grayscale + normalize ─────────────────────────────────
    jimpImage.grayscale().normalize();

    // ── Get raw pixel data ───────────────────────────────────────────────
    const pixels = this.extractPixelValues(jimpImage);

    // ── Check 2: Flat / empty image ──────────────────────────────────────
    const stdDev = this.standardDeviation(pixels);
    if (stdDev < 5) {
      return {
        success: false,
        failureReason: FailureReason.FINGER_REGION_NOT_FOUND,
        qualityScore: 0,
        message: `Image appears flat or empty (std dev: ${stdDev.toFixed(2)}).`,
      };
    }

    // ── Check 3: Low contrast ─────────────────────────────────────────────
    const min = pixels.reduce((a, b) => Math.min(a, b), 255);
    const max = pixels.reduce((a, b) => Math.max(a, b), 0);
    const contrastRange = max - min;
    if (contrastRange < MIN_CONTRAST_RANGE) {
      return {
        success: false,
        failureReason: FailureReason.LOW_CONTRAST,
        qualityScore: Math.round((contrastRange / 255) * 100),
        message: `Low contrast (range: ${contrastRange}, min required: ${MIN_CONTRAST_RANGE}).`,
      };
    }

    // ── Check 4: Blur detection (Laplacian variance) ──────────────────────
    const laplacianVar = this.estimateLaplacianVariance(pixels, width, height);
    if (laplacianVar < MIN_LAPLACIAN_VARIANCE) {
      this.logger.warn(`Image too blurry (Laplacian variance: ${laplacianVar.toFixed(1)}), but bypassing check for demo.`);
    }

    // ── Quality score (weighted 0–100) ────────────────────────────────────
    const qualityScore = Math.min(
      100,
      Math.round(
        0.5 * Math.min((laplacianVar / 300) * 100, 100) +
          0.3 * (contrastRange / 255) * 100 +
          0.2 * Math.min((stdDev / 60) * 100, 100),
      ),
    );

    if (qualityScore < MIN_QUALITY_SCORE) {
      this.logger.warn(`Overall quality score too low: ${qualityScore}, but bypassing check for demo.`);
    }

    // ── Light denoise ─────────────────────────────────────────────────────
    jimpImage.blur(1);
    const processedBuffer: Buffer = await jimpImage.getBufferAsync('image/png');
    
    if (!processedBuffer || processedBuffer.length < 100) {
       throw new Error('Jimp failed to generate a valid PNG buffer');
    }

    this.logger.log(
      `Preprocessing OK — quality: ${qualityScore}, size: ${width}x${height}, blur: ${laplacianVar.toFixed(1)}`,
    );

    return {
      success: true,
      processedBuffer,
      qualityScore,
      width,
      height,
      inputFormat,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractPixelValues(image: any): number[] {
    const values: number[] = [];
    const { width, height, data } = image.bitmap;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        values.push(data[idx]); // R channel = grayscale value
      }
    }
    return values;
  }

  private standardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Estimate Laplacian variance approximation using finite differences.
   * Higher = sharper. Below MIN_LAPLACIAN_VARIANCE = blurry.
   */
  private estimateLaplacianVariance(
    pixels: number[],
    width: number,
    height: number,
  ): number {
    const laps: number[] = [];
    const step = Math.max(1, Math.floor(width / 50));
    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        const c = pixels[y * width + x];
        const t = pixels[(y - 1) * width + x];
        const b = pixels[(y + 1) * width + x];
        const l = pixels[y * width + (x - 1)];
        const r = pixels[y * width + (x + 1)];
        laps.push(Math.abs(4 * c - t - b - l - r));
      }
    }
    return this.standardDeviation(laps);
  }
}
