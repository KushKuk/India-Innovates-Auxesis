import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokensService } from './tokens.service';

@Injectable()
export class TokensScheduler {
  private readonly logger = new Logger(TokensScheduler.name);

  constructor(private readonly tokensService: TokensService) {}

  /**
   * Run every minute to check for expired IN_PROGRESS tokens
   * This ensures that tokens not approved within 3 minutes are reverted
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTokenExpiration() {
    try {
      const count = await this.tokensService.checkAndExpireInProgressTokens();
      if (count > 0) {
        this.logger.log(`✅ Reverted ${count} expired token(s)`);
      }
    } catch (error) {
      this.logger.error('❌ Error checking token expiration:', error);
    }
  }
}
