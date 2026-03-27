const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const s = await prisma.voter.findFirst({ where: { name: { contains: 'Saarthak' } } });
  console.log('ACTUAL_ID:', s.id);
  await prisma.$disconnect();
}
check();
