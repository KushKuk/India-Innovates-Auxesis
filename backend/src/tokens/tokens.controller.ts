import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
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
}
