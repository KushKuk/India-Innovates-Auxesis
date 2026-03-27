import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FaceMatchProvider } from './face-match.provider';
import { FaceMatchResponse } from '../dto/verification.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import '@tensorflow/tfjs-backend-wasm';
import { Human, Config } from '@vladmandic/human/dist/human.node-wasm.js';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

@Injectable()
export class LocalFaceMatchProvider extends FaceMatchProvider implements OnModuleInit {
  private readonly logger = new Logger(LocalFaceMatchProvider.name);
  private human: Human;

  constructor(private prisma: PrismaService) {
    super();
    // Initialize human configuration
    const config: Partial<Config> = {
      // Point human to models via CDN because pure JS fallback relies on node fetch which rejects file:// protocols
      modelBasePath: 'https://vladmandic.github.io/human-models/models/',
      backend: 'wasm', // Fallback from tfjs-node for Windows compatibility
      wasmPath: join(process.cwd(), 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist', '/'), // Ensure TFJS loads the local module binaries
      debug: false,
      face: {
        enabled: true,
        detector: { 
          rotation: true, 
          return: true,
          minConfidence: 0.6, // Higher confidence requirement
          maxDetected: 1
        },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { 
          enabled: true,
          // modelPath is usually handled by Human.load(), but we can't easily switch model names via CDN easily.
          // Instead we'll increase internal quality.
        },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true }
      },
      // Reduce internal resolution for face processing to improve stability on WASM
      filter: {
        enabled: true,
        width: 540,
        height: 540,
        brightness: 0.1, // Slight brightness boost to normalize dark camera feeds
        contrast: 0.2,   // Contrast boost to make facial features more distinct
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false }
    };
    this.human = new Human(config);
  }

  async onModuleInit() {
    this.logger.log('Initializing Local Face Recognition Models...');
    try {
      this.human.env.node = true;
      
      this.logger.log('Initializing backend engines...');
      await this.human.init(); // Fully initializes backends
      await this.human.tf.ready(); // Make sure the selected backend runtime is fully ready
      
      await this.human.load();
      this.logger.log('Local models loaded successfully.');
    } catch (err) {
      this.logger.error(`Failed to load human models. Please ensure @vladmandic/human-models is installed. Error: ${err.message}`);
    }
  }

  async matchFace(
    liveImageBase64: string,
    voterId: string,
  ): Promise<FaceMatchResponse> {
    this.logger.log(`Performing LOCAL face match for voter: ${voterId}`);
    let refTensor, liveTensor;

    // Start a memory scope to automatically dispose intermediate tensors
    this.human.tf.engine().startScope();

    try {
      // 1. Fetch voter reference image
      const voter = await this.prisma.voter.findUnique({
        where: { id: voterId },
        select: { photoUrl: true, faceVerificationEnabled: true },
      });

      if (!voter || !voter.photoUrl) {
        return { matchStatus: 'ERROR', confidenceScore: 0, reason: 'No reference image found for voter', providerId: 'local-face-matcher' };
      }

      if (!voter.faceVerificationEnabled) {
        return { matchStatus: 'MATCH', confidenceScore: 1.0, reason: 'Face verification disabled for this voter record (admin override)', providerId: 'local-face-matcher' };
      }

      // 2. Load Reference Image
      const refPath = join(process.cwd(), voter.photoUrl);
      if (!existsSync(refPath)) {
        return { matchStatus: 'ERROR', confidenceScore: 0, reason: `Reference image file not found: ${voter.photoUrl}`, providerId: 'local-face-matcher' };
      }
      
      const referenceImageBuffer = await readFile(refPath);

      // 3. Decode Images
      this.logger.log('Step 1: Decoding images...');
      try {
        refTensor = this.human.tf.node ? this.human.tf.node.decodeImage(referenceImageBuffer) : await this.decodeImageFallback(referenceImageBuffer);
        
        const liveImageBuffer = Buffer.from(liveImageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        liveTensor = this.human.tf.node ? this.human.tf.node.decodeImage(liveImageBuffer) : await this.decodeImageFallback(liveImageBuffer);
      } catch (e) {
        this.logger.error(`Decoding failed: ${e.message}`);
        return { matchStatus: 'ERROR', confidenceScore: 0, reason: `Failed to decode images: ${e.message}`, providerId: 'local-face-matcher' };
      }

      // 4. Run Analysis SEQUENTIALLY to keep peak memory low
      this.logger.log('Step 2a: Detecting face in REFERENCE (heavy)...');
      const refRes = await this.human.detect(refTensor);
      
      this.logger.log('Step 2b: Detecting face in LIVE (heavy)...');
      const liveRes = await this.human.detect(liveTensor);

      // 5. Validate conditions
      this.logger.log('Step 3: Comparing results...');
      if (refRes.face.length === 0) return { matchStatus: 'ERROR', confidenceScore: 0, reason: 'No face detected in reference image', providerId: 'local-face-matcher' };
      if (liveRes.face.length === 0) return { matchStatus: 'NO_MATCH', confidenceScore: 0, reason: 'No face detected in live image', providerId: 'local-face-matcher' };
      if (liveRes.face.length > 1) return { matchStatus: 'ERROR', confidenceScore: 0, reason: 'Multiple faces detected. Please ensure only you are in frame.', providerId: 'local-face-matcher' };

      const refFace = refRes.face[0];
      const liveFace = liveRes.face[0];
      
      this.logger.log(`>> Similarity check: Ref Quality: ${refFace.score.toFixed(2)}, Live Quality: ${liveFace.score.toFixed(2)}`);

      if (liveFace.score < 0.6) { // Slightly lower threshold for stability
        return { matchStatus: 'NO_MATCH', confidenceScore: 0, reason: 'Low quality face capture', providerId: 'local-face-matcher' };
      }

      if (!liveFace.embedding || !refFace.embedding) {
        return { matchStatus: 'ERROR', confidenceScore: 0, reason: 'Biometric descriptor failed', providerId: 'local-face-matcher' };
      }

      const similarity = this.human.match.similarity(liveFace.embedding, refFace.embedding);
      const threshold = 0.55; 
      
      this.logger.log(`>> BIOMETRICS: Similarity: ${(similarity * 100).toFixed(1)}% | Threshold: ${threshold * 100}%`);
      
      if (similarity > threshold) {
        return { matchStatus: 'MATCH', confidenceScore: similarity, reason: `Identified (${(similarity * 100).toFixed(1)}%)`, providerId: 'local-face-matcher' };
      } else {
        return { matchStatus: 'NO_MATCH', confidenceScore: similarity, reason: `Mismatch (${(similarity * 100).toFixed(1)}%)`, providerId: 'local-face-matcher' };
      }
    } catch (e) {
      this.logger.error(`Biometric engine crash: ${e.message}`);
      return { matchStatus: 'ERROR', confidenceScore: 0, reason: `Internal engine error: ${e.message}`, providerId: 'local-face-matcher' };
    } finally {
      this.logger.log('Step 4: Memory cleanup...');
      // Dispose of the input tensors explicitly
      if (refTensor) this.human.tf.dispose(refTensor);
      if (liveTensor) this.human.tf.dispose(liveTensor);
      // End the overall memory scope
      this.human.tf.engine().endScope();
    }
  }

  private async decodeImageFallback(buffer: Buffer): Promise<any> {
    let width, height, data;

    // Detect if PNG or JPEG based on magic bytes
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      // It's a PNG
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      data = png.data;
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      // It's a JPEG
      const rawImageData = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      width = rawImageData.width;
      height = rawImageData.height;
      data = rawImageData.data;
    } else {
      throw new Error("Unsupported image format. Only JPEG and PNG are supported.");
    }
    
    // Human expects an RGB tensor tensor3d. 
    // We'll normalize to Float32 [0, 1] to ensure the AI gets the cleanest possible signal
    const numPixels = width * height;
    const rgbData = new Int32Array(numPixels * 3);
    
    for (let i = 0; i < numPixels; i++) {
        rgbData[i * 3 + 0] = data[i * 4 + 0]; 
        rgbData[i * 3 + 1] = data[i * 4 + 1];
        rgbData[i * 3 + 2] = data[i * 4 + 2];
    }
    
    await this.human.tf.ready();
    return this.human.tf.tensor3d(rgbData, [height, width, 3], 'int32');
  }
}

