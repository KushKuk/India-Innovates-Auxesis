import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { VotersModule } from './voters/voters.module';
import { VerificationModule } from './verification/verification.module';
import { TokensModule } from './tokens/tokens.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BoothModule } from './booth/booth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    VotersModule,
    VerificationModule,
    TokensModule,
    AuditModule,
    AuthModule,
    BoothModule,
  ],
})
export class AppModule {}
