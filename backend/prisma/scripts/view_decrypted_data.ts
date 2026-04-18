import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// --- STANDALONE DECRYPTION LOGIC ---
const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v2';
const FIELD_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY || '', 'hex');

function decrypt(encryptedText: string | null): string | null {
  if (!encryptedText || !encryptedText.startsWith(`${VERSION}:`)) {
    return encryptedText;
  }

  try {
    const [version, ivHex, tagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, FIELD_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    return `[Decryption Error: ${error.message}]`;
  }
}

async function main() {
  const prisma = new PrismaClient();

  console.log('--- SECURE ELECTORAL ROLL VIEW (Decrypted) ---\n');

  try {
    const voters = await prisma.voter.findMany({ 
        include: { 
            documents: {
                include: { documentType: true }
            } 
        } 
    });
    
    console.log(`Successfully connected to PostgreSQL. Found ${voters.length} voters.\n`);

    voters.forEach((v, index) => {
      console.log(`[Voter #${index + 1}]`);
      console.log(`- ID:      ${v.id}`);
      console.log(`- Name:    ${decrypt(v.name)}`); 
      console.log(`- DOB:     ${decrypt(v.dob)}`);
      console.log(`- Address: ${decrypt(v.address)}`);
      
      if (v.documents.length > 0) {
        console.log(`- Documents:`);
        v.documents.forEach(doc => {
            console.log(`  └─ ${doc.documentType?.name || 'ID'}: ${decrypt(doc.documentNumber)}`);
        });
      }
      console.log('-------------------------------------------');
    });

  } catch (err) {
    console.error('Error reading database:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
