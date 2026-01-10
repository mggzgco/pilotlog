-- CreateTable
CREATE TABLE "AircraftType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPreflightTemplateId" TEXT,
    "defaultPostflightTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AircraftType_pkey" PRIMARY KEY ("id")
);

-- Drop foreign keys and indexes tied to aircraft-specific templates
ALTER TABLE "ChecklistTemplate" DROP CONSTRAINT IF EXISTS "ChecklistTemplate_aircraftId_fkey";
DROP INDEX IF EXISTS "ChecklistTemplate_aircraftId_idx";
DROP INDEX IF EXISTS "ChecklistTemplate_aircraftTailNumber_idx";

-- AlterTable
ALTER TABLE "ChecklistTemplate" DROP COLUMN IF EXISTS "aircraftId",
DROP COLUMN IF EXISTS "aircraftTailNumber";

-- AlterTable
ALTER TABLE "Aircraft" ADD COLUMN "aircraftTypeId" TEXT,
ADD COLUMN "preflightChecklistTemplateId" TEXT,
ADD COLUMN "postflightChecklistTemplateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AircraftType_userId_name_key" ON "AircraftType"("userId", "name");
CREATE INDEX "AircraftType_userId_idx" ON "AircraftType"("userId");
CREATE INDEX "AircraftType_defaultPreflightTemplateId_idx" ON "AircraftType"("defaultPreflightTemplateId");
CREATE INDEX "AircraftType_defaultPostflightTemplateId_idx" ON "AircraftType"("defaultPostflightTemplateId");

-- CreateIndex
CREATE INDEX "Aircraft_aircraftTypeId_idx" ON "Aircraft"("aircraftTypeId");
CREATE INDEX "Aircraft_preflightChecklistTemplateId_idx" ON "Aircraft"("preflightChecklistTemplateId");
CREATE INDEX "Aircraft_postflightChecklistTemplateId_idx" ON "Aircraft"("postflightChecklistTemplateId");

-- AddForeignKey
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_defaultPreflightTemplateId_fkey" FOREIGN KEY ("defaultPreflightTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_defaultPostflightTemplateId_fkey" FOREIGN KEY ("defaultPostflightTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_preflightChecklistTemplateId_fkey" FOREIGN KEY ("preflightChecklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_postflightChecklistTemplateId_fkey" FOREIGN KEY ("postflightChecklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
