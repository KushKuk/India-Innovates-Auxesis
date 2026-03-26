import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed voters (matching frontend voterDatabase.ts)
  const voters = [
    { 
      id: 'VOT001', 
      name: 'Rajesh Kumar Singh', 
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
      id: 'VOT003', 
      name: 'Priya Sharma', 
      dob: '1990-03-22', 
      age: 34, 
      address: '456 Ashoka Road, Mumbai', 
      photoUrl: 's3://india-election-biometrics/voters/VOT002_ref.jpg', 
      photoVerifiedAt: new Date('2024-01-12T14:30:00Z'),
      faceVerificationEnabled: true,
      hasVoted: false 
    },
    { 
      id: 'VOT004', 
      name: 'Amit Patel', 
      dob: '1988-07-10', 
      age: 36, 
      address: '789 Raj Path, Bangalore', 
      photoUrl: 's3://india-election-biometrics/voters/VOT003_ref.jpg', 
      photoVerifiedAt: new Date('2023-12-05T09:15:00Z'),
      faceVerificationEnabled: true,
      hasVoted: true 
    },
    { 
      id: 'VOT005', 
      name: 'Sneha Gupta', 
      dob: '1992-11-30', 
      age: 32, 
      address: '321 Indira Nagar, Pune', 
      photoUrl: 's3://india-election-biometrics/voters/VOT004_ref.jpg', 
      photoVerifiedAt: new Date('2024-02-01T11:20:00Z'),
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
