-- Add standalone route fields and external sync identifiers to LogbookEntry

ALTER TABLE "LogbookEntry"
ADD COLUMN     "tailNumberSnapshot" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalFingerprint" TEXT,
ADD COLUMN     "externalUpdatedAt" TIMESTAMP(3);

CREATE INDEX "LogbookEntry_userId_date_idx" ON "LogbookEntry"("userId", "date");
CREATE INDEX "LogbookEntry_userId_tailNumberSnapshot_idx" ON "LogbookEntry"("userId", "tailNumberSnapshot");

CREATE UNIQUE INDEX "LogbookEntry_userId_externalSource_externalId_key"
ON "LogbookEntry"("userId", "externalSource", "externalId");

