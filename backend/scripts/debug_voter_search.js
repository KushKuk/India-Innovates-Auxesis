const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const SEARCH_KEY = Buffer.from(process.env.SEARCH_INDEX_KEY, 'hex');

function generateBlindIndex(text) {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  return crypto.createHmac('sha256', SEARCH_KEY).update(normalized).digest('hex');
}

async function debug() {
  const targetId = '801271369901';
  const targetHash = generateBlindIndex(targetId);

  console.log(`🔍 Debugging search for ID: ${targetId}`);
  console.log(`🗝️ Calculated Hash: ${targetHash}`);

  // 1. Search for documents with this hash
  const docs = await prisma.voterDocument.findMany({
    where: {
      documentNumberHash: targetHash
    },
    include: {
      voter: true
    }
  });

  if (docs.length === 0) {
    console.log('❌ No documents found with this hash.');
    
    // Check if the voter exists at all
    const allVoters = await prisma.voter.findMany({ take: 5 });
    console.log(`📋 Sample Voters in DB:`, allVoters.map(v => ({ id: v.id, name: v.name })));
    
    // Check if the document number exists in plaintext (just in case)
    const plaintextDocs = await prisma.voterDocument.findMany({
        where: { documentNumber: targetId }
    });
    if (plaintextDocs.length > 0) {
        console.log(`⚠️ Found ${plaintextDocs.length} documents with PLAINTEXT number. They are NOT encrypted.`);
    }

    // Check what hashes ARE in the database
    const sampleHashes = await prisma.voterDocument.findMany({
        take: 5,
        select: { documentNumber: true, documentNumberHash: true }
    });
    console.log('📋 Sample Hashes in DB:', sampleHashes);

  } else {
    console.log(`✅ Found ${docs.length} document(s) matching this hash:`);
    docs.forEach(d => {
      console.log(`  - Voter: ${d.voter.name} (${d.voterId})`);
      console.log(`  - Doc Number (Encrypted): ${d.documentNumber}`);
      console.log(`  - Doc Type Name: "${d.documentTypeName}"`);
      console.log(`  - Doc Type ID: ${d.documentTypeId}`);
    });
  }

  await prisma.$disconnect();
}

debug();
