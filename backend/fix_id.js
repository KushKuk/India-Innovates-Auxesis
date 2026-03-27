const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateId() {
  try {
    console.log('--- Updating Saarthak Garg Voter ID (Raw SQL) ---');

    // 1. Check if VOT012 exists and JDH7280183 doesn't
    const oldVoter = await prisma.$queryRawUnsafe(`SELECT id FROM Voter WHERE id = 'VOT012'`);
    const newExists = await prisma.$queryRawUnsafe(`SELECT id FROM Voter WHERE id = 'JDH7280183'`);

    if (oldVoter.length > 0 && newExists.length === 0) {
      console.log('Renaming VOT012 to JDH7280183...');
      
      // We must disable foreign key checks temporarily to update primary key
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
      
      await prisma.$executeRawUnsafe(`UPDATE Voter SET id = 'JDH7280183' WHERE id = 'VOT012'`);
      
      // Update foreign keys in all related tables
      await prisma.$executeRawUnsafe(`UPDATE Token SET voterId = 'JDH7280183' WHERE voterId = 'VOT012'`);
      await prisma.$executeRawUnsafe(`UPDATE AuditLog SET voterId = 'JDH7280183' WHERE voterId = 'VOT012'`);
      await prisma.$executeRawUnsafe(`UPDATE FingerprintTemplate SET voterId = 'JDH7280183' WHERE voterId = 'VOT012'`);
      await prisma.$executeRawUnsafe(`UPDATE VoterDocument SET voterId = 'JDH7280183' WHERE voterId = 'VOT012'`);
      
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
      
      console.log('✅ Voter ID updated successfully.');
    } else if (newExists.length > 0) {
      console.log('Record JDH7280183 already exists. No rename needed.');
    } else {
      console.log('Old record VOT012 not found. Maybe it was already changed?');
    }

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateId();
