import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class VotersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService, // Inject EncryptionService
  ) {}

  async search(name: string, dobOrAge?: string, useAge?: boolean) {
    if (!name) return [];
    
    // FETCH ALL VOTERS: The extended client will automatically decrypt their names
    const allVoters = await this.prisma.client.voter.findMany({
      include: {
        documents: {
          include: {
            documentType: true
          }
        }
      }
    });

    const searchStr = name.trim().toLowerCase();
    
    // PERFORM PARTIAL MATCH IN MEMORY
    // Since names are now decrypted, we can use standard JS string methods
    let voters = allVoters.filter(v => 
      v.name && v.name.toLowerCase().includes(searchStr)
    );

    voters.forEach(v => {
      console.log(`[SEARCH-DIAG] Voter ${v.id} (${v.name}): photoUrl="${v.photoUrl}"`);
    });

    if (voters.length === 0) return [];

    if (!dobOrAge) return voters;

    if (useAge) {
      const searchAge = parseInt(dobOrAge, 10);
      return voters.filter((v) => Math.abs(v.age - searchAge) <= 1);
    } else {
      return voters.filter((v) => v.dob === dobOrAge);
    }
  }

  async findById(id: string) {
    return this.prisma.client.voter.findUnique({
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
    return this.prisma.client.voter.update({
      where: { id },
      data: { 
        hasVoted: true,
        votingStatus: 'VOTED'
      },
    });
  }

  async updateVotingStatus(id: string, status: string) {
    return this.prisma.client.voter.update({
      where: { id },
      data: { votingStatus: status },
    });
  }

  /**
   * Get voter voting status
   * Returns PENDING, IN_PROGRESS, VOTED, or EXPIRED
   */
  async getVotingStatus(id: string) {
    const voter = await this.prisma.client.voter.findUnique({ where: { id } });
    
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
    return this.prisma.client.voter.findMany();
  }
}
