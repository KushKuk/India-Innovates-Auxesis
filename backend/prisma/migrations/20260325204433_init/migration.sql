-- CreateTable
CREATE TABLE "Voter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoVerifiedAt" DATETIME,
    "faceVerificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "votingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "verificationMode" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "votingStatus" TEXT NOT NULL DEFAULT 'TOKEN_ACTIVE',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "confirmedAt" DATETIME,
    CONSTRAINT "Token_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminal" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "voterId" TEXT,
    "officerId" TEXT,
    CONSTRAINT "AuditLog_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Officer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'officer',
    "boothId" TEXT
);

-- CreateTable
CREATE TABLE "Booth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boothCode" TEXT NOT NULL,
    "constituency" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_code_key" ON "Token"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Officer_officerId_key" ON "Officer"("officerId");

-- CreateIndex
CREATE UNIQUE INDEX "Booth_boothCode_key" ON "Booth"("boothCode");
