import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VotersService {
  constructor(private prisma: PrismaService) {}

  async search(name: string, dobOrAge?: string, useAge?: boolean) {
    const searchName = name.toLowerCase().trim();

    const voters = await this.prisma.voter.findMany({
      where: {
        name: { contains: searchName, mode: 'insensitive' },
      },
    });

    if (!dobOrAge) return voters;

    if (useAge) {
      const searchAge = parseInt(dobOrAge, 10);
      return voters.filter((v) => Math.abs(v.age - searchAge) <= 1);
    } else {
      return voters.filter((v) => v.dob === dobOrAge);
    }
  }

  async findById(id: string) {
    return this.prisma.voter.findUnique({ where: { id } });
  }

  async markAsVoted(id: string) {
    return this.prisma.voter.update({
      where: { id },
      data: { hasVoted: true },
    });
  }

  async findAll() {
    return this.prisma.voter.findMany();
  }
}
