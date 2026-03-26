import { FingerprintMatcherService } from '../services/fingerprint-matcher.service';
import { FingerprintExtractorService } from '../services/fingerprint-extractor.service';
import { FailureReason } from '../fingerprint.constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDescriptor(count: number, offset = 0) {
  const minutiae = Array.from({ length: count }, (_, i) => ({
    x: (i * 20) + offset,
    y: (i * 15) + offset,
    angle: i * 0.2,
    type: (i % 2 === 0 ? 'ending' : 'bifurcation') as 'ending' | 'bifurcation',
  }));
  return Buffer.from(JSON.stringify({ minutiae, version: 'sourcefis-v1' }));
}

function makeConfigService(threshold = 40) {
  return {
    get: (key: string) => key === 'FINGERPRINT_MATCH_THRESHOLD' ? String(threshold) : null,
    getOrThrow: (key: string) => {
      if (key === 'FINGERPRINT_ENCRYPTION_KEY') return '0'.repeat(64); // 32-byte hex key
      throw new Error(`Missing config: ${key}`);
    },
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FingerprintMatcherService', () => {
  let matcher: FingerprintMatcherService;
  let extractor: FingerprintExtractorService;

  beforeEach(() => {
    extractor = new FingerprintExtractorService();
    matcher = new FingerprintMatcherService(makeConfigService(40), extractor);
  });

  it('should be defined', () => {
    expect(matcher).toBeDefined();
  });

  it('should return NO_ENROLLED_TEMPLATES when enrolled list is empty', async () => {
    const probe = makeDescriptor(15);
    const result = await matcher.matchBest(probe, []);
    expect(result.matched).toBe(false);
    expect(result.failureReason).toBe(FailureReason.NO_ENROLLED_TEMPLATES);
    expect(result.score).toBe(0);
  });

  it('spatialMinutiaeScore: identical descriptors should score 100', () => {
    const svc = matcher as any;
    const desc = JSON.parse(makeDescriptor(20).toString('utf8'));
    const score = svc.spatialMinutiaeScore(desc, desc);
    expect(score).toBe(100);
  });

  it('spatialMinutiaeScore: completely different descriptors should score 0', () => {
    const svc = matcher as any;
    const descA = JSON.parse(makeDescriptor(15, 0).toString('utf8'));
    const descB = JSON.parse(makeDescriptor(15, 5000).toString('utf8')); // far away
    const score = svc.spatialMinutiaeScore(descA, descB);
    expect(score).toBe(0);
  });

  it('angleDiff should return value in [-π, π]', () => {
    const svc = matcher as any;
    const diff = svc.angleDiff(Math.PI * 1.5, 0);
    expect(Math.abs(diff)).toBeLessThanOrEqual(Math.PI);
  });

  it('should return threshold from config', async () => {
    const probe = makeDescriptor(15);
    const result = await matcher.matchBest(probe, []);
    expect(result.threshold).toBe(40);
  });

  it('should use higher custom threshold from config', async () => {
    const highThresholdMatcher = new FingerprintMatcherService(makeConfigService(75), extractor);
    const probe = makeDescriptor(15);
    const result = await highThresholdMatcher.matchBest(probe, []);
    expect(result.threshold).toBe(75);
  });
});
