import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const rishit = await prisma.voter.findFirst({
    where: {
      name: {
        contains: 'Rishit',
        mode: 'insensitive',
      },
    },
  });
  console.log('Rishit Data:', JSON.stringify(rishit, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
