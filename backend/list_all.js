const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  try {
    const voters = await prisma.voter.findMany({ select: { id: true, name: true } });
    console.log('--- VOTER ROLL ---');
    voters.forEach(v => console.log(`[${v.id}] ${v.name}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
list();
