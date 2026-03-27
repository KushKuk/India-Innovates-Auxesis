import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VotersService {
  constructor(private prisma: PrismaService) {}

  async search(name: string, dobOrAge?: string, useAge?: boolean) {
    const searchName = name.toLowerCase().trim();

    const voters = await (this.prisma.voter as any).findMany({
      where: {
        name: { contains: searchName },
      },
      include: {
        documents: {
          include: {
            documentType: true
          }
        }
      }
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
    return (this.prisma.voter as any).findUnique({
      where: { id },
      include: {
        documents: {
          include: {
            documentType: true
          }
        }
      }
    });
  }

  async markAsVoted(id: string) {
    return this.prisma.voter.update({
      where: { id },
      data: { 
        hasVoted: true,
        votingStatus: 'VOTED'
      },
    });
  }

  async updateVotingStatus(id: string, status: string) {
    return this.prisma.voter.update({
      where: { id },
      data: { votingStatus: status },
    });
  }

  /**
   * Get voter voting status
   * Returns PENDING, IN_PROGRESS, VOTED, or EXPIRED
   */
  async getVotingStatus(id: string) {
    const voter = await this.prisma.voter.findUnique({ where: { id } });
    
    if (!voter) {
      return { status: 'NOT_FOUND', canVote: false };
    }

    const canVote = voter.votingStatus === 'PENDING' && !voter.hasVoted;

    return {
      status: voter.votingStatus,
      hasVoted: voter.hasVoted,
      canVote,
      voter,
    };
  }

  async findAll() {
    return this.prisma.voter.findMany();
  }
}
