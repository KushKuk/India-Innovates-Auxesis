import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const FIELD_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex');
const SEARCH_KEY = Buffer.from(process.env.SEARCH_INDEX_KEY!, 'hex');
const IV_LENGTH = 12;
const VERSION = 'v2';

function encrypt(text: string): string {
  if (!text || text.startsWith(VERSION + ':')) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, FIELD_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${VERSION}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function generateBlindIndex(text: string): string {
  if (!text) return '';
  const normalized = text.trim().toLowerCase();
  return crypto.createHmac('sha256', SEARCH_KEY).update(normalized).digest('hex');
}

async function main() {
  const prisma = new PrismaClient();
  
  console.log('Starting in-place encryption for existing PostgreSQL records...');

  // 1. Encrypt Voters
  const voters = await prisma.voter.findMany();
  console.log(`Processing ${voters.length} voters...`);
  for (const voter of voters) {
    // Only encrypt if not already encrypted
    if (voter.name && !voter.name.startsWith(VERSION + ':')) {
      await prisma.voter.update({
        where: { id: voter.id },
        data: {
          name: encrypt(voter.name),
          dob: encrypt(voter.dob),
          address: encrypt(voter.address),
          nameHash: generateBlindIndex(voter.name),
        },
      });
    }
  }

  // 2. Encrypt Officers
  const officers = await prisma.officer.findMany();
  console.log(`Processing ${officers.length} officers...`);
  for (const officer of officers) {
    if (officer.name && !officer.name.startsWith(VERSION + ':')) {
      await prisma.officer.update({
        where: { id: officer.id },
        data: {
          name: encrypt(officer.name),
        },
      });
    }
  }

  console.log('\nSUCCESS: In-place encryption complete.');
  await prisma.$disconnect();
}

main().catch(console.error);
