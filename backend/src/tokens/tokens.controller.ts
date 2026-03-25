import { Controller, Get, Patch, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TokensService } from './tokens.service';
import { ValidateTokenDto, UpdateTokenStatusDto } from './dto/token.dto';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('active')
  @ApiOperation({ summary: 'List all active (non-expired) tokens' })
  async findAllActive() {
    return this.tokensService.findAllActive();
  }

  @Get('validate')
  @ApiOperation({ summary: 'Lookup active token by voter ID or ID type+number' })
  async validate(@Query() dto: ValidateTokenDto) {
    return this.tokensService.validate(dto.voterId, dto.idType, dto.idNumber);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update token voting status (IN_PROGRESS, VOTED, etc.)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTokenStatusDto,
  ) {
    return this.tokensService.updateStatus(id, dto.status);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'TVO verifies token - sets status to IN_PROGRESS with 3-min timeout' })
  async verifyToken(@Param('id') id: string) {
    return this.tokensService.verifyToken(id);
  }

  @Patch(':id/approve-voting')
  @ApiOperation({ summary: 'TVO approves voting - marks token and voter as VOTED, prevents duplicate voting' })
  async approveVoting(@Param('id') id: string) {
    return this.tokensService.approveVoting(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get token expiration status and remaining time' })
  async getTokenStatus(@Param('id') id: string) {
    return this.tokensService.getTokenStatus(id);
  }

  @Post('check-expired')
  @ApiOperation({ summary: 'Check and revert expired IN_PROGRESS tokens (run periodically)' })
  async checkExpiredTokens() {
    const count = await this.tokensService.checkAndExpireInProgressTokens();
    return { message: `Reverted ${count} expired token(s)`, count };
  }
}
