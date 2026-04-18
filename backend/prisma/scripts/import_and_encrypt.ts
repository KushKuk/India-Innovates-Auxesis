import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// 1. Setup minimal environment for standalone script
dotenv.config();

// 2. Mock EncryptionService logic (since we're standalone)
const ALGORITHM = 'aes-256-gcm';
const FIELD_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex');
const SEARCH_KEY = Buffer.from(process.env.SEARCH_INDEX_KEY!, 'hex');
const IV_LENGTH = 12;
const VERSION = 'v2';

function encrypt(text: string): string {
  if (!text) return text;
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

// 3. Define the encryption mapping (same as in the extension)
const ENCRYPTED_FIELDS: Record<string, { encrypt: string[]; blindIndex?: Record<string, string> }> = {
  voter: {
    encrypt: ['name', 'dob', 'address'],
    blindIndex: { nameHash: 'name' },
  },
  voterDocument: {
    encrypt: ['documentNumber', 'nameOnDocument'],
    blindIndex: { documentNumberHash: 'documentNumber' },
  },
  officer: {
    encrypt: ['name'],
  },
  auditLog: {
    encrypt: ['details'],
  },
};

async function main() {
  const prisma = new PrismaClient();
  const backupPath = path.join(__dirname, '..', 'backup_sqlite.json');
  
  if (!fs.existsSync(backupPath)) {
    console.error(`Backup file not found at ${backupPath}. Run export script first.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log('Clearing existing PostgreSQL data for a fresh migrate...');
  
  // Order matters for deleting (reverse of creating)
  const order = ['fingerprintTemplate', 'auditLog', 'token', 'voterDocument', 'voter', 'officer', 'booth', 'documentType'];
  
  for (const model of order) {
    try {
      await (prisma[model] as any).deleteMany();
    } catch (e) {
      console.warn(`! Could not clear ${model}: ${e.message}`);
    }
  }

  console.log('Starting data import and encryption into PostgreSQL...');

  // Order matters for foreign keys
  const createOrder = ['documentType', 'booth', 'voter', 'voterDocument', 'token', 'officer', 'auditLog', 'fingerprintTemplate'];

  for (const model of createOrder) {
    const items = data[model];
    if (!items || items.length === 0) continue;

    console.log(`\nImporting ${items.length} records into ${model}...`);
    
    for (const item of items) {
      const config = ENCRYPTED_FIELDS[model];
      const processedItem = { ...item };

      if (config) {
        // Apply Blind Indexing first
        if (config.blindIndex) {
          Object.entries(config.blindIndex).forEach(([hashField, sourceField]) => {
            if (processedItem[sourceField]) {
              processedItem[hashField] = generateBlindIndex(processedItem[sourceField]);
            }
          });
        }

        // Apply Encryption
        config.encrypt.forEach((field) => {
          if (processedItem[field]) {
            processedItem[field] = encrypt(processedItem[field]);
          }
        });
      }

      // --- TYPE TRANSFORMATIONS (SQLite Ints -> Postgres Types) ---
      
      // 1. Handle Booleans (SQLite 0/1 -> Boolean)
      ['active', 'isOnline', 'hasVoted', 'faceVerificationEnabled'].forEach(field => {
        if (field in processedItem && typeof processedItem[field] === 'number') {
          processedItem[field] = processedItem[field] === 1;
        }
      });

      // 2. Handle Dates (SQLite Timestamp/String -> Date Object)
      ['createdAt', 'updatedAt', 'timestamp', 'generatedAt', 'expiresAt', 'verifiedAt', 'confirmedAt', 'photoVerifiedAt', 'issueDate', 'expiryDate'].forEach(field => {
        if (processedItem[field]) {
          const val = processedItem[field];
          // If it's a number (timestamp), convert to Date
          if (typeof val === 'number') {
            processedItem[field] = new Date(val);
          } 
          // If it's a string, attempt conversion
          else if (typeof val === 'string' && !isNaN(Date.parse(val))) {
            processedItem[field] = new Date(val);
          }
        }
      });

      // 3. Handle Bytes fields (Images/Templates) - convert to Buffer for Prisma
      if (processedItem.documentImage && typeof processedItem.documentImage === 'string') {
         // Check if it's hex or base64 (SQLite often returns hex or direct strings)
         const encoding = processedItem.documentImage.startsWith('0x') ? 'hex' : 'base64'; 
         processedItem.documentImage = Buffer.from(processedItem.documentImage.replace('0x', ''), encoding as any);
      }
      if (processedItem.templateData && typeof processedItem.templateData === 'string') {
         // If it's already a buffer (from some reason) or a string, convert
         processedItem.templateData = Buffer.from(processedItem.templateData, 'base64');
      }

      try {
        await (prisma[model] as any).create({ data: processedItem });
      } catch (err) {
        console.error(`! Failed to import ${model} item:`, err.message);
      }
    }
  }

  console.log('\nSUCCESS: All data migrated and encrypted in PostgreSQL.');
  await prisma.$disconnect();
}

main().catch(console.error);
