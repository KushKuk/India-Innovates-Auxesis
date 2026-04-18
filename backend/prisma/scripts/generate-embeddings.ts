import { PrismaClient } from '@prisma/client';
import { join } from 'path';

const prisma = new PrismaClient();
const BRIDGE_URL = 'http://localhost:8000';

async function generateEmbeddings() {
  console.log('--- Biometric Embedding Generator ---');
  
  // 1. Check if bridge is online
  try {
    const health = await fetch(`${BRIDGE_URL}/health`);
    if (!health.ok) throw new Error('Bridge unhealthy');
    const data = await health.json();
    console.log(`✓ Face Bridge online: ${data.model}`);
  } catch (err) {
    console.error('✗ Error: Face Bridge is not reachable. Start it first with "python face-bridge/main.py"');
    process.exit(1);
  }

  // 2. Fetch voters missing embeddings
  const voters = await (prisma.voter as any).findMany({
    where: {
      faceEmbedding: null,
      photoUrl: { not: '' }
    }
  });

  console.log(`Found ${voters.length} voters needing biometric embeddings.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    const progress = `[${i + 1}/${voters.length}]`;
    
    try {
      const fullPath = join(process.cwd(), voter.photoUrl);
      console.log(`${progress} Processing: ${voter.name} (${voter.id})...`);

      const response = await fetch(`${BRIDGE_URL}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_path: fullPath
        }),
      });
      
      const data = await response.json();

      if (response.ok && data.status === 'success' && data.embedding) {
          // Convert float array to Buffer for Prisma
          const embeddingBuffer = Buffer.from(new Float32Array(data.embedding).buffer);
          
          await (prisma.voter as any).update({
            where: { id: voter.id },
            data: { 
              faceEmbedding: embeddingBuffer,
              faceEmbeddingVersion: 'arcface-buffalo-s'
            },
          });
          console.log(`  ✓ Success: Embedding stored.`);
          successCount++;
      } else {
          console.warn(`  ! Warning: ${data.reason || 'No face detected'}`);
          failCount++;
      }
    } catch (e) {
        console.error(`  ✗ Failed: ${e.message}`);
        failCount++;
    }
  }

  console.log('\n--- Migration Complete ---');
  console.log(`Total Success: ${successCount}`);
  console.log(`Total Failures/Skips: ${failCount}`);
  
  await prisma.$disconnect();
}

generateEmbeddings().catch(err => {
    console.error('Migration crashed:', err);
    process.exit(1);
});
