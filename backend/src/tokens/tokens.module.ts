import { Module } from '@nestjs/common';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { TokensScheduler } from './tokens.scheduler';

@Module({
  controllers: [TokensController],
  providers: [TokensService, TokensScheduler],
  exports: [TokensService],
})
export class TokensModule {}
