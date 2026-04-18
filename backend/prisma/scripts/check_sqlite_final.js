const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:../dev.db',
      },
    },
  });

  const models = ['voter', 'documentType', 'voterDocument', 'token', 'officer', 'booth', 'auditLog', 'fingerprintTemplate'];

  console.log('--- CONTENT OF SQLITE (dev.db) ---');

  for (const model of models) {
    try {
      const count = await prisma[model].count();
      console.log(`- ${model}: ${count} records`);
    } catch (err) {
      console.warn(`! Model ${model} check failed: ${err.message}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
