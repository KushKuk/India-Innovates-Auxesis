const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(Voter)`);
    console.log('Voter Table Columns:', JSON.stringify(tableInfo, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
check();
