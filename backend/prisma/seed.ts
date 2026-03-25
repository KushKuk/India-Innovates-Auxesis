import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed voters (matching frontend voterDatabase.ts)
  const voters = [
    { id: 'VOT001', name: 'Rajesh Kumar Singh', dob: '1985-05-15', age: 39, address: '123 Gandhi Nagar, New Delhi', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh', hasVoted: false },
    { id: 'VOT002', name: 'Priya Sharma', dob: '1990-03-22', age: 34, address: '456 Ashoka Road, Mumbai', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', hasVoted: false },
    { id: 'VOT003', name: 'Amit Patel', dob: '1988-07-10', age: 36, address: '789 Raj Path, Bangalore', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit', hasVoted: true },
    { id: 'VOT004', name: 'Sneha Gupta', dob: '1992-11-30', age: 32, address: '321 Indira Nagar, Pune', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sneha', hasVoted: false },
    { id: 'VOT005', name: 'Rahul Singh', dob: '1987-09-18', age: 37, address: '654 Model Town, Delhi', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul', hasVoted: false },
    { id: 'VOT006', name: 'Deepika Verma', dob: '1995-02-14', age: 31, address: '987 Connaught Place, Delhi', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=deepika', hasVoted: false },
    { id: 'VOT007', name: 'Arjun Kumar', dob: '1984-08-05', age: 40, address: '111 Park Street, Kolkata', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun', hasVoted: false },
    { id: 'VOT008', name: 'Nirupama Pillai', dob: '1993-06-25', age: 33, address: '222 M.G. Road, Bangalore', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nirupama', hasVoted: false },
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
