const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const templates = await prisma.fingerprintTemplate.findMany({
      include: { voter: true }
    });
    console.log(`Found ${templates.length} templates:`);
    templates.forEach(t => {
      console.log(`Voter: ${t.voter.name} (${t.voterId}), Label: ${t.fingerLabel}, Type: ${t.templateType}`);
    });
  } catch (err) {
    console.error('DATABASE ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
