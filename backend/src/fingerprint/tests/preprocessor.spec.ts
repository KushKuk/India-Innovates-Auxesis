import {
  FingerprintPreprocessorService,
  PreprocessOutput,
} from '../services/fingerprint-preprocessor.service';
import { FailureReason } from '../fingerprint.constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a simple solid PNG-like buffer stub (used for mocking) */
function makeBuffer(content = 'fake-image-data'): Buffer {
  return Buffer.from(content);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FingerprintPreprocessorService', () => {
  let service: FingerprintPreprocessorService;

  beforeEach(() => {
    service = new FingerprintPreprocessorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('preprocess() with invalid/empty buffer', () => {
    it('should return INTERNAL_ERROR if image buffer cannot be decoded', async () => {
      const result = await service.preprocess(makeBuffer('not-an-image'), 'image/jpeg');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failureReason).toBe(FailureReason.INTERNAL_ERROR);
      }
    });
  });

  describe('quality check logic internals', () => {
    it('standardDeviation should return 0 for a uniform array', () => {
      const svc = service as any;
      const sd = svc.standardDeviation([128, 128, 128, 128]);
      expect(sd).toBeCloseTo(0, 2);
    });

    it('standardDeviation should return >0 for a non-uniform array', () => {
      const svc = service as any;
      const sd = svc.standardDeviation([0, 128, 255, 64]);
      expect(sd).toBeGreaterThan(0);
    });

    it('estimateLaplacianVariance should return a number', () => {
      const svc = service as any;
      const pixels = Array.from({ length: 400 }, (_, i) => (i % 50) * 5);
      const variance = svc.estimateLaplacianVariance(pixels, 20, 20);
      expect(typeof variance).toBe('number');
      expect(variance).toBeGreaterThanOrEqual(0);
    });
  });
});
