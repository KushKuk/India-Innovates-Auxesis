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

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update voter voting status' })
  async updateStatus(@Param('id') id: string, @Query('status') status: string) {
    return this.votersService.updateVotingStatus(id, status);
  }

  @Patch(':id/voted')
  @ApiOperation({ summary: 'Mark voter as voted' })
  async markAsVoted(@Param('id') id: string) {
    return this.votersService.markAsVoted(id);
  }

  @Get(':id/voting-status')
  @ApiOperation({ summary: 'Get voter voting status - checks if already voted or in progress' })
  async getVotingStatus(@Param('id') id: string) {
    return this.votersService.getVotingStatus(id);
  }


  @Get()
  @ApiOperation({ summary: 'List all voters' })
  async findAll() {
    return this.votersService.findAll();
  }
}
