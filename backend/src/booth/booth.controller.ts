import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BoothService } from './booth.service';

@ApiTags('Booth')
@Controller('booth')
export class BoothController {
  constructor(private readonly boothService: BoothService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Get booth info by booth code' })
  async findByCode(@Param('code') code: string) {
    return this.boothService.findByCode(code);
  }

  @Get()
  @ApiOperation({ summary: 'List all booths' })
  async findAll() {
    return this.boothService.findAll();
  }
}
