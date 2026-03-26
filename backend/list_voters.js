const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const voters = await prisma.voter.findMany({ select: { id: true, name: true } });
  console.log('--- ALL VOTERS IN DATABASE ---');
  voters.forEach(v => console.log(`${v.id}: ${v.name}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
