import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { FingerprintController } from './fingerprint.controller';
import { FingerprintService } from './fingerprint.service';
import { FingerprintPreprocessorService } from './services/fingerprint-preprocessor.service';
import { FingerprintExtractorService } from './services/fingerprint-extractor.service';
import { FingerprintMatcherService } from './services/fingerprint-matcher.service';
import { FingerprintLogService } from './services/fingerprint-log.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ storage: undefined }),
  ],
  controllers: [FingerprintController],
  providers: [
    FingerprintService,
    FingerprintPreprocessorService,
    FingerprintExtractorService,
    FingerprintMatcherService,
    FingerprintLogService,
  ],
  exports: [FingerprintService],
})
export class FingerprintModule {}
