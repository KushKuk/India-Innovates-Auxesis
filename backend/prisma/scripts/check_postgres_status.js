import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/common/encryption/encryption.service';
import { ConfigService } from '@nestjs/config';
import { encryptionExtension } from '../src/prisma/extensions/encryption.extension';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // 1. Manually setup EncryptionService outside NestJS for this script
  const configService = new ConfigService({
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
    SEARCH_INDEX_KEY: process.env.SEARCH_INDEX_KEY,
  });
  const encryptionService = new EncryptionService(configService);

  // 2. Create the Extended Prisma Client
  const prismaBase = new PrismaClient();
  const prisma = prismaBase.$extends(encryptionExtension(encryptionService));

  console.log('--- SECURE DATABASE VIEW (Decrypted) ---\n');

  try {
    const voters = await prisma.voter.findMany({ include: { documents: true } });
    console.log(`Found ${voters.length} total voters.`);

    voters.forEach((v, index) => {
      console.log(`\n[Voter #${index + 1}]`);
      console.log(`- ID: ${v.id}`);
      console.log(`- Name: ${v.name}`); // Should show readable name!
      console.log(`- DOB:  ${v.dob}`);
      console.log(`- Docs: ${v.documents.length} attached`);
      
      v.documents.forEach(doc => {
        console.log(`  └─ ${doc.documentTypeName}: ${doc.documentNumber}`);
      });
    });

  } catch (err) {
    console.error('Error reading database:', err.message);
  }

  await prismaBase.$disconnect();
}

main().catch(console.error);

  fs.writeFileSync(logFile, report);
  console.log(`\nReport written to ${logFile}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  fs.writeFileSync('./prisma/postgres_status_report.txt', `FATAL ERROR: ${err.message}\n${err.stack}`);
  process.exit(1);
});
