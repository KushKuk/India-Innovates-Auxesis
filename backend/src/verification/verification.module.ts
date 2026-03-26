import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { TokensModule } from '../tokens/tokens.module';
import { AuditModule } from '../audit/audit.module';
import { RekognitionFaceMatchProvider } from './providers/rekognition-face-match.provider';
import { LocalFaceMatchProvider } from './providers/local-face-match.provider';
import { MockFaceMatchProvider } from './providers/mock-face-match.provider';
import { FaceMatchProvider } from './providers/face-match.provider';
import { PrismaModule } from '../../src/prisma/prisma.module'; // Import PrismaModule for the providers

@Module({
  imports: [TokensModule, AuditModule, ConfigModule, PrismaModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    RekognitionFaceMatchProvider,
    LocalFaceMatchProvider,
    MockFaceMatchProvider,
    {
      provide: FaceMatchProvider,
      inject: [ConfigService, LocalFaceMatchProvider, MockFaceMatchProvider, RekognitionFaceMatchProvider],
      useFactory: (
        config: ConfigService,
        local: LocalFaceMatchProvider,
        mock: MockFaceMatchProvider,
        rekognition: RekognitionFaceMatchProvider
      ) => {
        const providerName = config.get<string>('FACE_MATCH_PROVIDER', 'mock');
        if (providerName === 'local') return local;
        if (providerName === 'rekognition') return rekognition;
        return mock;
      },
    },
  ],
})
export class VerificationModule {}
