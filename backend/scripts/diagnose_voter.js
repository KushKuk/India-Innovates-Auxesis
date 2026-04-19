const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();
const searchKey = Buffer.from(process.env.SEARCH_INDEX_KEY, 'hex');

function generateBlindIndex(text) {
  if (!text) return '';
  const normalized = text.trim().toLowerCase();
  return crypto
    .createHmac('sha256', searchKey)
    .update(normalized)
    .digest('hex');
}

async function main() {
  const targetId = process.argv[2] || 'JDH7280183';
  console.log(`🔍 Diagnosing search for ID: ${targetId}`);
  
  const targetHash = generateBlindIndex(targetId);
  console.log(`🗝️ Calculated Hash: ${targetHash}`);

  // 1. Search by Hash
  const docByHash = await prisma.voterDocument.findFirst({
    where: { documentNumberHash: targetHash },
    include: { voter: true }
  });

  if (docByHash) {
    console.log('✅ Found match by HASH:');
    console.log(`   - Voter: ${docByHash.voter.name} (${docByHash.voter.id})`);
    console.log(`   - Doc Number (Raw): ${docByHash.documentNumber}`);
    return;
  }

  // 2. Scan all documents to find if the ID exists but has a different hash
  console.log('🔎 Scanning all documents for partial match...');
  const allDocs = await prisma.voterDocument.findMany({
    include: { voter: true }
  });

  let found = false;
  for (const doc of allDocs) {
    if (doc.documentNumber && doc.documentNumber.includes(targetId)) {
      console.log('⚠️ Found match by RAW STRING (but hash differs!):');
      console.log(`   - Voter: ${doc.voter.name} (${doc.voter.id})`);
      console.log(`   - Doc Number in DB: "${doc.documentNumber}"`);
      console.log(`   - Hash in DB: ${doc.documentNumberHash}`);
      console.log(`   - Hash we expected: ${generateBlindIndex(doc.documentNumber)}`);
      found = true;
    }
  }

  if (!found) {
    console.log('❌ No documents found matching this ID string even partially.');
    // Check if maybe it's the internal voter ID
    const voterByPk = await prisma.voter.findUnique({ where: { id: targetId } });
    if (voterByPk) {
      console.log('💡 Note: This IS an internal Voter UUID, but not a document number.');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
