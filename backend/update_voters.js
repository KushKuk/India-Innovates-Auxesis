const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  try {
    console.log('--- Updating Voter documentType field ---');

    console.log('Updating Satyam Tiwari...');
    await prisma.$executeRawUnsafe(`
      UPDATE Voter SET documentType = 'Aadhaar Card' WHERE name LIKE '%Satyam%'
    `);

    console.log('Updating Rishit Sahay...');
    await prisma.$executeRawUnsafe(`
      UPDATE Voter SET documentType = 'PAN Card' WHERE name LIKE '%Rishit%'
    `);

    console.log('✅ Updated Voter records.');

  } catch (err) {
    console.error('❌ UPDATE ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

update();
