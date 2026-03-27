const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log('--- Database Check ---');
    const voterCount = await prisma.voter.count();
    console.log(`Total Voters: ${voterCount}`);
    
    const satyam = await prisma.voter.findFirst({
      where: { name: { contains: 'Satyam' } }
    });
    console.log('Satyam in Voter table:', satyam ? 'FOUND' : 'NOT FOUND');

    try {
      const docCount = await prisma.voterDocument.count();
      console.log(`Total VoterDocuments: ${docCount}`);
    } catch (e) {
      console.log('VoterDocument table likely does not exist yet.');
    }

  } catch (err) {
    console.error('Error checking database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
