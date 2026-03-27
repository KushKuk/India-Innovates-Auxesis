-- AlterTable
ALTER TABLE "Voter" ADD COLUMN "gender" TEXT;

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VoterDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voterId" TEXT NOT NULL,
    "documentTypeId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "nameOnDocument" TEXT,
    "issuingAuthority" TEXT,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "documentImage" BLOB,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" DATETIME,
    "remarks" TEXT,
    CONSTRAINT "VoterDocument_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VoterDocument_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_name_key" ON "DocumentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VoterDocument_voterId_documentTypeId_key" ON "VoterDocument"("voterId", "documentTypeId");
