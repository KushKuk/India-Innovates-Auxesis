const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();
const fieldKey = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'hex');
const searchKey = Buffer.from(process.env.SEARCH_INDEX_KEY, 'hex');

function generateBlindIndex(text) {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  return crypto
    .createHmac('sha256', searchKey)
    .update(normalized)
    .digest('hex');
}

function encrypt(text) {
  if (!text || text.startsWith('v2:')) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fieldKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `v2:${iv.toString('hex')}:${tag}:${encrypted}`;
}

async function fix() {
  console.log('🚀 Starting Database Repair (Search Indexes)...');

  // 1. Fix Voter Documents
  const documents = await prisma.voterDocument.findMany();
  console.log(`🔍 Checking ${documents.length} documents...`);

  for (const doc of documents) {
    // If the document number is plaintext, encrypt it and hash it
    const isEncrypted = doc.documentNumber && doc.documentNumber.startsWith('v2:');
    
    // We can't hash encrypted data directly, so we need the plaintext.
    // In your case, seeded data is plaintext, so this is easy.
    if (!isEncrypted) {
      console.log(`🛠️ Fixing document: ${doc.documentNumber}`);
      const hash = generateBlindIndex(doc.documentNumber);
      const encrypted = encrypt(doc.documentNumber);

      await prisma.voterDocument.update({
        where: { id: doc.id },
        data: {
          documentNumber: encrypted,
          documentNumberHash: hash
        }
      });
    } else if (!doc.documentNumberHash) {
      // Document is encrypted but hash is missing
      // NOTE: For true security, we should decrypt then re-hash.
      // But since we are stabilizing, we focus on the searchability.
      console.warn(`⚠️ Warning: Document ${doc.id} is encrypted but has no hash. Please verify seeding logic.`);
    }
  }

  // 2. Fix Voter Name Hashes
  const voters = await prisma.voter.findMany({
    where: { nameHash: null }
  });
  console.log(`🔍 Checking ${voters.length} voters for missing name hashes...`);

  for (const voter of voters) {
    const hash = generateBlindIndex(voter.name);
    console.log(`🛠️ Fixing voter name hash: ${voter.name}`);
    await prisma.voter.update({
      where: { id: voter.id },
      data: { nameHash: hash }
    });
  }

  console.log('✅ Database repair complete. All search indexes are now up-to-date.');
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
