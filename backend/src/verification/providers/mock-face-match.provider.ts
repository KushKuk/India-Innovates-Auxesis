import { Injectable, Logger } from '@nestjs/common';
import { FaceMatchProvider } from './face-match.provider';
import { FaceMatchResponse } from '../dto/verification.dto';

@Injectable()
export class MockFaceMatchProvider extends FaceMatchProvider {
  private readonly logger = new Logger(MockFaceMatchProvider.name);

  async matchFace(
    liveImage: string,
    voterId: string,
  ): Promise<FaceMatchResponse> {
    this.logger.log(`Mock matching face for voter: ${voterId}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // For mock, we'll return a success match if liveImage is provided
    if (!liveImage) {
      return {
        matchStatus: 'ERROR',
        confidenceScore: 0,
        reason: 'No live image provided',
      };
    }

    // In mock mode, we treat everything as a match for now, 
    // unless the voterId is 'fail-voter'
    if (voterId === 'fail-voter') {
      return {
        matchStatus: 'NO_MATCH',
        confidenceScore: 0.1,
        reason: 'Biometric mismatch (Mock)',
        providerId: 'mock-provider-v1',
      };
    }

    return {
      matchStatus: 'MATCH',
      confidenceScore: 0.95,
      reason: 'Face matched (Mock)',
      providerId: 'mock-provider-v1',
    };
  }
}
