const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const backupPath = path.join(__dirname, '../prisma/backup_sqlite.json');
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Error: prisma/backup_sqlite.json not found!');
    return;
  }

  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  console.log('🚀 Starting Data Migration...');

  // Helper to parse Python-style byte strings: b'\xfa\xbf...'
  const parsePythonBytes = (str) => {
    if (typeof str !== 'string' || !str.startsWith("b'")) return str;
    
    // Simple parser for \xHH sequences
    const hex = str
      .slice(2, -1) // remove b' and '
      .replace(/\\x([0-9a-fA-F]{2})/g, (match, p1) => p1);
    
    return Buffer.from(hex, 'hex');
  };

  // 1. Booths
  console.log('📦 Migrating Booths...');
  for (const booth of data.booth || []) {
    await prisma.booth.upsert({
      where: { boothCode: booth.boothCode },
      update: {},
      create: {
        id: booth.id,
        boothCode: booth.boothCode,
        constituency: booth.constituency,
        isOnline: Boolean(booth.isOnline),
      },
    });
  }

  // 2. Officers
  console.log('📦 Migrating Officers...');
  for (const officer of data.officer || []) {
    await prisma.officer.upsert({
      where: { officerId: officer.officerId },
      update: {},
      create: {
        id: officer.id,
        officerId: officer.officerId,
        name: officer.name,
        passwordHash: officer.passwordHash,
        role: officer.role,
        boothId: officer.boothId,
      },
    });
  }

  // 3. Document Types
  console.log('📦 Migrating Document Types...');
  for (const docType of data.documentType || []) {
    await prisma.documentType.upsert({
      where: { name: docType.name },
      update: {},
      create: {
        id: docType.id,
        name: docType.name,
      },
    });
  }

  // 4. Voters
  console.log('📦 Migrating Voters...');
  for (const voter of data.voter || []) {
    await prisma.voter.upsert({
      where: { id: voter.id },
      update: {},
      create: {
        id: voter.id,
        name: voter.name,
        dob: voter.dob,
        age: voter.age,
        address: voter.address,
        photoUrl: voter.photoUrl,
        photoVerifiedAt: voter.photoVerifiedAt ? new Date(voter.photoVerifiedAt) : null,
        faceVerificationEnabled: Boolean(voter.faceVerificationEnabled),
        votingStatus: voter.votingStatus,
        hasVoted: Boolean(voter.hasVoted),
        createdAt: voter.createdAt ? new Date(voter.createdAt) : undefined,
        gender: voter.gender,
        documentType: voter.documentType,
        nameHash: voter.nameHash,
        faceEmbedding: voter.faceEmbedding ? parsePythonBytes(voter.faceEmbedding) : null,
      },
    });
  }

  // 5. Voter Documents
  console.log('📦 Migrating Voter Documents...');
  for (const doc of data.voterDocument || []) {
    await prisma.voterDocument.upsert({
      where: { id: doc.id },
      update: {},
      create: {
        id: doc.id,
        voterId: doc.voterId,
        documentTypeId: doc.documentTypeId,
        documentTypeName: doc.documentTypeName,
        documentNumber: doc.documentNumber,
        nameOnDocument: doc.nameOnDocument,
        issuingAuthority: doc.issuingAuthority,
        issueDate: doc.issueDate ? new Date(doc.issueDate) : null,
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
        verificationStatus: doc.verificationStatus,
        verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt) : null,
        remarks: doc.remarks,
        documentNumberHash: doc.documentNumberHash,
        documentImage: doc.documentImage ? parsePythonBytes(doc.documentImage) : null,
      },
    });
  }

  // 6. Tokens
  console.log('📦 Migrating Tokens...');
  for (const token of data.token || []) {
    await prisma.token.upsert({
      where: { code: token.code },
      update: {},
      create: {
        id: token.id,
        code: token.code,
        voterId: token.voterId,
        verificationMode: token.verificationMode,
        idType: token.idType,
        idNumber: token.idNumber,
        votingStatus: token.votingStatus,
        generatedAt: token.generatedAt ? new Date(token.generatedAt) : undefined,
        expiresAt: new Date(token.expiresAt),
        verifiedAt: token.verifiedAt ? new Date(token.verifiedAt) : null,
        confirmedAt: token.confirmedAt ? new Date(token.confirmedAt) : null,
      },
    });
  }

  // 7. Audit Logs
  console.log('📦 Migrating Audit Logs...');
  for (const log of data.auditLog || []) {
    await prisma.auditLog.create({
      data: {
        id: log.id,
        timestamp: new Date(log.timestamp),
        terminal: log.terminal,
        action: log.action,
        status: log.status,
        details: log.details,
        voterId: log.voterId,
        officerId: log.officerId,
      },
    });
  }

  // 8. Fingerprint Templates
  console.log('📦 Migrating Fingerprint Templates...');
  for (const ft of data.fingerprintTemplate || []) {
    await prisma.fingerprintTemplate.create({
      data: {
        id: ft.id,
        voterId: ft.voterId,
        fingerLabel: ft.fingerLabel,
        templateType: ft.templateType,
        templateData: parsePythonBytes(ft.templateData),
        iv: ft.iv,
        qualityScore: ft.qualityScore,
        imageRef: ft.imageRef,
        templateVersion: ft.templateVersion,
        active: Boolean(ft.active),
        createdAt: new Date(ft.createdAt),
      },
    });
  }

  console.log('🎉 Migration Successful!');
}

main()
  .catch((e) => {
    console.error('❌ Migration Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
