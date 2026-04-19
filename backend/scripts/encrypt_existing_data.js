const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v2';

const FIELD_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'hex');
const SEARCH_KEY = Buffer.from(process.env.SEARCH_INDEX_KEY, 'hex');

function encrypt(text) {
  if (!text || text.startsWith(`${VERSION}:`)) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, FIELD_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${VERSION}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decrypt(encryptedText) {
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
    console.error('Decryption failed:', error.message);
    return encryptedText;
  }
}

function generateBlindIndex(text) {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  return crypto.createHmac('sha256', SEARCH_KEY).update(normalized).digest('hex');
}

async function main() {
  console.log('🚀 Starting Data Encryption Migration...');

  // 1. Process Voters
  const voters = await prisma.voter.findMany();
  console.log(`Processing ${voters.length} voters...`);
  for (const voter of voters) {
    const data = {};
    let needsUpdate = false;

    // Encrypt fields if not already encrypted
    ['name', 'dob', 'address'].forEach(field => {
      if (voter[field] && !voter[field].startsWith(`${VERSION}:`)) {
        data[field] = encrypt(voter[field]);
        needsUpdate = true;
      }
    });

    // Generate hashes
    const rawName = voter.name && voter.name.startsWith(`${VERSION}:`) 
      ? decrypt(voter.name) 
      : voter.name;
    
    const nameHash = generateBlindIndex(rawName);
    if (nameHash && voter.nameHash !== nameHash) {
      data.nameHash = nameHash;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.voter.update({ where: { id: voter.id }, data });
      console.log(`  ✅ Updated voter: ${voter.id}`);
    }
  }

  // 2. Process VoterDocuments
  const docs = await prisma.voterDocument.findMany();
  console.log(`Processing ${docs.length} voter documents...`);
  for (const doc of docs) {
    const data = {};
    let needsUpdate = false;

    ['documentNumber', 'nameOnDocument'].forEach(field => {
      if (doc[field] && !doc[field].startsWith(`${VERSION}:`)) {
        data[field] = encrypt(doc[field]);
        needsUpdate = true;
      }
    });

    const docNumHash = generateBlindIndex(doc.documentNumber && !doc.documentNumber.startsWith(`${VERSION}:`) ? doc.documentNumber : null);
    if (docNumHash && doc.documentNumberHash !== docNumHash) {
      data.documentNumberHash = docNumHash;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.voterDocument.update({ where: { id: doc.id }, data });
      console.log(`  ✅ Updated document: ${doc.id}`);
    }
  }

  // 3. Process Officers
  const officers = await prisma.officer.findMany();
  console.log(`Processing ${officers.length} officers...`);
  for (const officer of officers) {
    if (officer.name && !officer.name.startsWith(`${VERSION}:`)) {
      await prisma.officer.update({
        where: { id: officer.id },
        data: { name: encrypt(officer.name) }
      });
      console.log(`  ✅ Updated officer: ${officer.officerId}`);
    }
  }

  // 4. Process AuditLogs
  const logs = await prisma.auditLog.findMany();
  console.log(`Processing ${logs.length} audit logs...`);
  for (const log of logs) {
    if (log.details && !log.details.startsWith(`${VERSION}:`)) {
      await prisma.auditLog.update({
        where: { id: log.id },
        data: { details: encrypt(log.details) }
      });
      console.log(`  ✅ Updated log: ${log.id}`);
    }
  }

  console.log('🎉 Migration Complete!');
}

main()
  .catch(e => {
    console.error('❌ Migration Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
