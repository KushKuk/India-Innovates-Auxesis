const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const counts = await prisma.voter.count();
    console.log(`Voter count: ${counts}`);
    const voters = await prisma.voter.findMany({
      where: { id: { in: ['VOT001', 'VOT012'] } },
      select: { id: true, photoUrl: true, hasVoted: true }
    });
    console.log('Found voters:', JSON.stringify(voters, null, 2));
  } catch (err) {
    console.error('DATABASE ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
