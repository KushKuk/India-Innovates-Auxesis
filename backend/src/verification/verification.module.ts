import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { TokensModule } from '../tokens/tokens.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TokensModule, AuditModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
