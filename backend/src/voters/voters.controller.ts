import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VotersService } from './voters.service';
import { SearchVoterDto } from './dto/search-voter.dto';

@ApiTags('Voters')
@Controller('voters')
export class VotersController {
  constructor(private readonly votersService: VotersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search voters in electoral roll by name and DOB/age' })
  async search(@Query() dto: SearchVoterDto) {
    return this.votersService.search(dto.name, dto.dobOrAge, dto.useAge);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get voter by ID' })
  async findById(@Param('id') id: string) {
    return this.votersService.findById(id);
  }

  @Patch(':id/voted')
  @ApiOperation({ summary: 'Mark voter as voted' })
  async markAsVoted(@Param('id') id: string) {
    return this.votersService.markAsVoted(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all voters' })
  async findAll() {
    return this.votersService.findAll();
  }
}
