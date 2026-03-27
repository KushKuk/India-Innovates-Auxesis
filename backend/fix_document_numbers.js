const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🛠️ Fixing document numbers for demo voters...');

  const dataFixes = [
    {
      name: 'Rishit Sahay',
      voterId: 'VOT011',
      documentTypeName: 'PAN Card',
      newNumber: 'FHSKT59831A'
    },
    {
      name: 'Sarthak Garg',
      voterId: 'JDH7280183',
      documentTypeName: 'Aadhaar Card',
      newNumber: '482019385721'
    },
    {
      name: 'Ramesh Kumar Singh',
      voterId: 'VOT001',
      documentTypeName: 'Aadhaar Card',
      newNumber: '998877665544'
    }
  ];

  for (const fix of dataFixes) {
    console.log(`Checking ${fix.name} (${fix.voterId})...`);
    
    // Find or create the document type
    const docType = await prisma.documentType.findUnique({
      where: { name: fix.documentTypeName }
    });

    if (!docType) {
      console.log(`  ⚠️ Document type ${fix.documentTypeName} not found. Skipping.`);
      continue;
    }

    // Upsert the document
    await prisma.voterDocument.upsert({
      where: {
        voterId_documentTypeId: {
          voterId: fix.voterId,
          documentTypeId: docType.id
        }
      },
      update: {
        documentNumber: fix.newNumber
      },
      create: {
        voterId: fix.voterId,
        documentTypeId: docType.id,
        documentNumber: fix.newNumber,
        verificationStatus: 'VERIFIED'
      }
    });

    console.log(`  ✅ Updated ${fix.documentTypeName} to ${fix.newNumber}`);
  }

  console.log('\n✨ Data fix complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
