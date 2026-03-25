import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/audit.dto';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  @ApiOperation({ summary: 'Append a new audit log entry' })
  async create(@Body() dto: CreateAuditDto) {
    return this.auditService.log(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Query audit logs (filterable by terminal and status)' })
  async findAll(
    @Query('terminal') terminal?: string,
    @Query('status') status?: string,
  ) {
    return this.auditService.findAll(terminal, status);
  }
}
