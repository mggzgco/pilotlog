-- AlterTable
ALTER TABLE "Flight" ADD COLUMN "aircraftId" TEXT;

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN "aircraftId" TEXT;

-- Backfill aircraft relationships on existing flights
UPDATE "Flight" AS f
SET "aircraftId" = a."id"
FROM "Aircraft" AS a
WHERE f."aircraftId" IS NULL
  AND f."userId" = a."userId"
  AND COALESCE(NULLIF(BTRIM(f."tailNumberSnapshot"), ''), NULLIF(BTRIM(f."tailNumber"), '')) = a."tailNumber";

-- CreateIndex
CREATE INDEX "Flight_aircraftId_idx" ON "Flight"("aircraftId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_aircraftId_idx" ON "ChecklistTemplate"("aircraftId");

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
