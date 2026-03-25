import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Append a new audit log entry
   */
  async log(data: {
    terminal: string;
    action: string;
    status: string;
    details?: string;
    voterId?: string;
    officerId?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  /**
   * Query audit logs with optional filters
   */
  async findAll(terminal?: string, status?: string) {
    const where: any = {};
    if (terminal) where.terminal = terminal;
    if (status) where.status = status;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }
}
