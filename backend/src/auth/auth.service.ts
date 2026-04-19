import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(officerId: string, password: string) {
    const officer = await this.prisma.client.officer.findUnique({
      where: { officerId },
    });

    if (!officer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, officer.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: officer.id,
      officerId: officer.officerId,
      role: officer.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      officer: {
        id: officer.id,
        officerId: officer.officerId,
        name: officer.name,
        role: officer.role,
      },
    };
  }

  async getProfile(officerUuid: string) {
    const officer = await this.prisma.client.officer.findUnique({
      where: { id: officerUuid },
    });
    if (!officer) throw new UnauthorizedException();

    return {
      id: officer.id,
      officerId: officer.officerId,
      name: officer.name,
      role: officer.role,
    };
  }
}
