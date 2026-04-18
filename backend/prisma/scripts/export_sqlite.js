const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  // Create a Prisma client pointing specifically to the SQLite file
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:../dev.db', // Path from scripts folder to prisma folder
      },
    },
  });

  const exportData = {};
  // Models to export (Mapped to SQLite table names)
  const models = {
    voter: 'Voter',
    documentType: 'DocumentType',
    voterDocument: 'VoterDocument',
    token: 'Token',
    officer: 'Officer',
    booth: 'Booth',
    auditLog: 'AuditLog',
    fingerprintTemplate: 'FingerprintTemplate'
  };

  console.log('Starting data export from SQLite...');

  for (const [prismaModel, sqliteTable] of Object.entries(models)) {
    try {
      // We use raw query bypass mapping issues
      exportData[prismaModel] = await prisma.$queryRawUnsafe(`SELECT * FROM "${sqliteTable}"`);
      console.log(`- Exported ${exportData[prismaModel].length} rows from ${sqliteTable}`);
    } catch (err) {
      console.warn(`! Skipping ${sqliteTable}: ${err.message}`);
    }
  }

  fs.writeFileSync('./prisma/backup_sqlite.json', JSON.stringify(exportData, null, 2));
  console.log('\nSUCCESS: Backup saved to ./prisma/backup_sqlite.json');
  await prisma.$disconnect();
}

main().catch(console.error);
