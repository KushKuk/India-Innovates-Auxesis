import { FaceMatchResponse } from '../dto/verification.dto';

export abstract class FaceMatchProvider {
  /**
   * Compares a live captured image against a reference image.
   * @param liveImage Base64 or Blob image data
   * @param referenceData Voter information or reference image key
   */
  abstract matchFace(
    liveImage: string,
    voterId: string,
  ): Promise<FaceMatchResponse>;
}
