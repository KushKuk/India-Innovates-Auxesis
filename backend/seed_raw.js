const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('--- Manual Raw SQL Seed ---');

    // 1. Insert Voter
    const voterId = 'VOT014';
    const name = 'Satyam Tiwari';
    const dob = '2005-01-17';
    const age = 21;
    const gender = 'Male';
    const address = 'C/O: Saurabh Tiwari, House No.142, Street 5 , Block C, Sector 3, PO: Rohini DIST : North West, Delhi-110085';
    const photoUrl = 'uploads/voters/satyam-tiwari.png';

    console.log(`Inserting voter ${name}...`);
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO Voter (id, name, dob, age, gender, address, photoUrl, faceVerificationEnabled, hasVoted, votingStatus, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'PENDING', CURRENT_TIMESTAMP)
    `, voterId, name, dob, age, gender, address, photoUrl);

    // 2. Ensure DocumentType exists
    console.log('Ensuring Aadhaar Card type exists...');
    await prisma.$executeRawUnsafe(`
      INSERT OR IGNORE INTO DocumentType (name) VALUES ('Aadhaar Card')
    `);

    // Get the ID of the Aadhaar Card document type
    const docTypes = await prisma.$queryRawUnsafe(`SELECT id FROM DocumentType WHERE name = 'Aadhaar Card'`);
    const aadharTypeId = docTypes[0].id;

    // 3. Insert VoterDocument
    console.log('Inserting Aadhar document details...');
    const aadharNumber = '801271369901';
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO VoterDocument (voterId, documentTypeId, documentNumber, nameOnDocument, verificationStatus)
      VALUES (?, ?, ?, ?, 'VERIFIED')
    `, voterId, aadharTypeId, aadharNumber, name);

    console.log('✅ Satyam Tiwari and Aadhar details inserted successfully!');

  } catch (err) {
    console.error('❌ RAW SEED ERROR:', err.message);
    if (err.message.includes('no such table')) {
      console.log('Wait, the tables really do not exist. Attempting to force push schema again...');
    }
  } finally {
    await prisma.$disconnect();
  }
}

seed();
