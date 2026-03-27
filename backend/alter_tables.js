const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function alter() {
  try {
    console.log('--- Manual Schema Alteration ---');

    console.log('Adding documentType to Voter table...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE Voter ADD COLUMN documentType TEXT`);
    } catch (e) {
      console.log('Voter.documentType already exists or error:', e.message);
    }

    console.log('Adding documentTypeName to VoterDocument table...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE VoterDocument ADD COLUMN documentTypeName TEXT`);
    } catch (e) {
      console.log('VoterDocument.documentTypeName already exists or error:', e.message);
    }

    // Update records
    console.log('Updating records...');
    
    // Satyam
    await prisma.$executeRawUnsafe(`UPDATE Voter SET documentType = 'Aadhaar Card' WHERE name LIKE '%Satyam%'`);
    await prisma.$executeRawUnsafe(`UPDATE VoterDocument SET documentTypeName = 'Aadhaar Card' WHERE voterId IN (SELECT id FROM Voter WHERE name LIKE '%Satyam%')`);

    // Rishit
    await prisma.$executeRawUnsafe(`UPDATE Voter SET documentType = 'PAN Card' WHERE name LIKE '%Rishit%'`);
    await prisma.$executeRawUnsafe(`UPDATE VoterDocument SET documentTypeName = 'PAN Card' WHERE voterId IN (SELECT id FROM Voter WHERE name LIKE '%Rishit%')`);

    console.log('✅ Done!');

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

alter();
