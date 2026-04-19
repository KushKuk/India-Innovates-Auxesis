import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoothService {
  constructor(private prisma: PrismaService) {}

  async findByCode(code: string) {
    return this.prisma.client.booth.findUnique({ where: { boothCode: code } });
  }

  async findAll() {
    return this.prisma.client.booth.findMany();
  }
}
