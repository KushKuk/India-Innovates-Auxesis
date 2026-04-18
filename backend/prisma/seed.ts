import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EncryptionService } from '../src/common/encryption/encryption.service';
import { encryptionExtension } from '../src/prisma/extensions/encryption.extension';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config();

// Standard standalone script workaround for EncryptionService
const configService = new ConfigService(process.env);
const encryptionService = new EncryptionService(configService);
const rawPrisma = new PrismaClient();
const prisma = rawPrisma.$extends(encryptionExtension(encryptionService));

async function main() {
  console.log('🌱 Seeding database...');

  // Seed voters (matching frontend voterDatabase.ts)
  const voters = [
    { 
      id: 'VOT001', 
      name: 'Ramesh Kumar Singh', 
      dob: '1985-05-15', 
      age: 39, 
      address: '123 Gandhi Nagar, New Delhi', 
      photoUrl: 'uploads/voters/kushaagra-goel.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'VOT002', 
      name: 'Pranav Shukla', 
      dob: '1992-08-20', 
      age: 32, 
      address: '456 Ashoka Road, Mumbai', 
      photoUrl: 'uploads/voters/pranav-shukla.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'VOT011', 
      name: 'Rishit Sahay', 
      dob: '1990-03-22', 
      age: 34, 
      address: '456 Ashoka Road, Mumbai', 
      photoUrl: 'uploads/voters/rishit-sahay.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'JDH7280183', 
      name: 'Sarthak Garg', 
      dob: '1988-07-10', 
      age: 36, 
      address: '789 Raj Path, Bangalore', 
      photoUrl: 'uploads/voters/saarthak-garg.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'VOT013', 
      name: 'Sahil', 
      dob: '1992-11-30', 
      age: 32, 
      gender: 'Male',
      address: '321 Indira Nagar, Pune', 
      photoUrl: 'uploads/voters/sahil.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'VOT014', 
      name: 'Satyam Tiwari', 
      dob: '2005-01-17', 
      age: 21, 
      gender: 'Male',
      address: 'C/O: Saurabh Tiwari, House No.142, Street 5 , Block C, Sector 3, PO: Rohini DIST : North West, Delhi-110085', 
      photoUrl: 'uploads/voters/satyam-tiwari.png', 
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'FHSKT59831A', 
      name: 'Test Voter (Physical QR)', 
      dob: '2000-01-01', 
      age: 24, 
      gender: 'Male',
      address: 'Test Address for Physical QR Scan', 
      photoUrl: 'uploads/voters/satyam-tiwari.png', // Using existing photo for demo
      photoVerifiedAt: new Date(),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
  ];

  for (const voter of voters) {
    await prisma.voter.upsert({
      where: { id: voter.id },
      update: voter,
      create: voter,
    });
  }
  console.log(`  ✅ ${voters.length} voters seeded`);

  // Seed Document Types
  const aadharType = await prisma.documentType.upsert({
    where: { name: 'Aadhaar Card' },
    update: {},
    create: { name: 'Aadhaar Card' },
  });
  
  const panType = await prisma.documentType.upsert({
    where: { name: 'PAN Card' },
    update: {},
    create: { name: 'PAN Card' },
  });

  const voterIdType = await prisma.documentType.upsert({
    where: { name: 'Voter ID Card' },
    update: {},
    create: { name: 'Voter ID Card' },
  });

  console.log('  ✅ Document Types seeded');

  // Seed Voter Documents for Satyam
  await prisma.voterDocument.upsert({
    where: { 
      voterId_documentTypeId: { voterId: 'VOT014', documentTypeId: aadharType.id }
    },
    update: { documentNumber: '801271369901', nameOnDocument: 'Satyam Tiwari' },
    create: { 
      voterId: 'VOT014',
      documentTypeId: aadharType.id,
      documentNumber: '801271369901',
      nameOnDocument: 'Satyam Tiwari',
      verificationStatus: 'VERIFIED'
    },
  });

  // Also seed a document for the physical test QR
  await prisma.voterDocument.upsert({
    where: { 
      voterId_documentTypeId: { voterId: 'FHSKT59831A', documentTypeId: voterIdType.id }
    },
    update: { documentNumber: 'FHSKT59831A', nameOnDocument: 'Test Voter' },
    create: { 
      voterId: 'FHSKT59831A',
      documentTypeId: voterIdType.id,
      documentNumber: 'FHSKT59831A',
      nameOnDocument: 'Test Voter',
      verificationStatus: 'VERIFIED'
    },
  });
  console.log('  ✅ Voter Documents seeded');

  // Seed officers
  const passwordHash = await bcrypt.hash('password123', 10);
  const officers = [
    { officerId: 'EO001', name: 'Electoral Officer 1', passwordHash, role: 'officer', boothId: 'BH-2024-0147' },
    { officerId: 'SUP001', name: 'Supervisor 1', passwordHash, role: 'supervisor', boothId: 'BH-2024-0147' },
  ];

  for (const officer of officers) {
    await prisma.officer.upsert({
      where: { officerId: officer.officerId },
      update: officer,
      create: officer,
    });
  }
  console.log(`  ✅ ${officers.length} officers seeded`);

  // Seed booth
  await prisma.booth.upsert({
    where: { boothCode: 'BH-2024-0147' },
    update: { constituency: 'New Delhi - 01', isOnline: true },
    create: { boothCode: 'BH-2024-0147', constituency: 'New Delhi - 01', isOnline: true },
  });
  console.log('  ✅ Booth seeded');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
