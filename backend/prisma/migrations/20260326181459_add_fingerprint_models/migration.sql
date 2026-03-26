-- CreateTable
CREATE TABLE "FingerprintTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voterId" TEXT NOT NULL,
    "fingerLabel" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "templateData" BLOB NOT NULL,
    "iv" TEXT NOT NULL,
    "qualityScore" REAL NOT NULL,
    "imageRef" TEXT,
    "templateVersion" TEXT NOT NULL DEFAULT 'sourcefis-v1',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FingerprintTemplate_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FingerprintLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "fingerLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "qualityScore" REAL,
    "matchScore" REAL,
    "threshold" REAL NOT NULL,
    "failureReason" TEXT,
    "extractorUsed" TEXT NOT NULL,
    "matchedTemplateId" TEXT,
    "inputFormat" TEXT,
    "templateVersion" TEXT,
    "deviceId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
