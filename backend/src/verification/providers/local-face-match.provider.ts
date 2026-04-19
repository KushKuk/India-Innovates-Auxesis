import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FaceMatchProvider } from './face-match.provider';
import { FaceMatchResponse } from '../dto/verification.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'path';

/**
 * LocalFaceMatchProvider
 * Migrated to use Python Face Bridge (ArcFace/InsightFace) for high accuracy
 * and Raspberry Pi 5 optimized inference.
 */
@Injectable()
export class LocalFaceMatchProvider extends FaceMatchProvider implements OnModuleInit {
  private readonly logger = new Logger(LocalFaceMatchProvider.name);
  private readonly bridgeUrl = 'http://localhost:8000';

  constructor(private prisma: PrismaService) {
    super();
  }

  async onModuleInit() {
    this.logger.log('Initializing Local Face Recognition (ArcFace)...');
    try {
      // Check if Python bridge is online
      const response = await fetch(`${this.bridgeUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        this.logger.log(`Face Bridge Online: ${data.model} (CPU Temp: ${data.cpu_temp})`);
      } else {
        this.logger.warn('Face Bridge connection failed. Ensure the Python service is running on port 8000.');
      }
    } catch (err) {
      this.logger.error(`Face Bridge unreachable: ${err.message}. Ensure Python face-bridge is started.`);
    }
  }

  async matchFace(
    liveImageBase64: string,
    voterId: string,
  ): Promise<FaceMatchResponse> {
    this.logger.log(`Performing ARCFACE match for voter: ${voterId}`);

    try {
      // 1. Fetch voter biometric data
      const voter = await this.prisma.client.voter.findUnique({
        where: { id: voterId },
        select: { photoUrl: true, faceVerificationEnabled: true, faceEmbedding: true } as any,
      }) as any;

      if (!voter || !voter.photoUrl) {
        return { matchStatus: 'ERROR', confidenceScore: 0, reason: 'No reference data found for voter', providerId: 'arcface-bridge' };
      }

      if (!voter.faceVerificationEnabled) {
        return { matchStatus: 'MATCH', confidenceScore: 1.0, reason: 'Face verification disabled for this voter record', providerId: 'arcface-bridge' };
      }

      // 2. Prepare request for Face Bridge
      const requestBody: any = {
        live_image: liveImageBase64,
      };

      if (voter.faceEmbedding) {
        // High-speed match using stored embedding
        this.logger.log('Using stored embedding for fast verification...');
        // Convert Buffer to regular array of floats for JSON
        const buffer = voter.faceEmbedding as Buffer;
        const floatArray = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.length / 4
        );
        requestBody.stored_embedding = Array.from(floatArray);
      } else {
        // Fallback to path-based match (first time verify)
        this.logger.log('No embedding found. Processing reference image from disk...');
        // Send relative path so Docker container can resolve it correctly
        requestBody.ref_image = voter.photoUrl;
      }

      // 3. Call Face Bridge
      const start = Date.now();
      const response = await fetch(`${this.bridgeUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Bridge returned an error');
      }

      const result = await response.json();
      const latency = Date.now() - start;
      this.logger.log(`Bridge Response (${latency}ms): Match=${result.match}, Confidence=${(result.confidence * 100).toFixed(1)}%`);

      // 4. Persistence: If match is successful and we don't have an embedding, extract and save it
      if (result.match && !voter.faceEmbedding) {
        this.logger.log('Success! Extracting embedding for future use...');
        this.saveEmbeddingInBackground(liveImageBase64, voterId);
      }

      return {
        matchStatus: result.match ? 'MATCH' : 'NO_MATCH',
        confidenceScore: result.confidence,
        reason: result.match ? `Identified (${(result.confidence * 100).toFixed(1)}%)` : result.reason || 'Mismatch',
        providerId: 'arcface-bridge'
      };

    } catch (e) {
      this.logger.error(`Face Bridge error: ${e.message}`);
      return { matchStatus: 'ERROR', confidenceScore: 0, reason: `Biometric service error: ${e.message}`, providerId: 'arcface-bridge' };
    }
  }

  /**
   * Saves the face embedding to the database in the background to not block the main response.
   */
  private async saveEmbeddingInBackground(image: string, voterId: string) {
    try {
      const response = await fetch(`${this.bridgeUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.embedding) {
          // Convert float array to Buffer for Prisma
          const embeddingBuffer = Buffer.from(new Float32Array(data.embedding).buffer);
          
          await this.prisma.client.voter.update({
            where: { id: voterId },
            data: { 
              faceEmbedding: embeddingBuffer,
              faceEmbeddingVersion: 'arcface-buffalo-s'
            } as any,
          });
          this.logger.log(`Successfully stored biometric embedding for voter ${voterId}`);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to save background embedding: ${err.message}`);
    }
  }
}

