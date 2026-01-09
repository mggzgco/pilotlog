-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('PLANNED', 'PREFLIGHT_SIGNED', 'POSTFLIGHT_IN_PROGRESS', 'POSTFLIGHT_SIGNED', 'IMPORTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AutoImportStatus" AS ENUM ('NONE', 'RUNNING', 'MATCHED', 'AMBIGUOUS', 'NOT_FOUND', 'FAILED');

-- CreateEnum
CREATE TYPE "ChecklistPhase" AS ENUM ('PREFLIGHT', 'POSTFLIGHT');

-- CreateEnum
CREATE TYPE "ChecklistInputType" AS ENUM ('CHECK', 'YES_NO', 'NUMBER', 'TEXT');

-- CreateEnum
CREATE TYPE "ChecklistRunStatus" AS ENUM ('NOT_AVAILABLE', 'IN_PROGRESS', 'SIGNED');

-- AlterTable
ALTER TABLE "Flight" RENAME COLUMN "departAt" TO "startTime";

-- AlterTable
ALTER TABLE "Flight" RENAME COLUMN "arriveAt" TO "endTime";

-- AlterTable
ALTER TABLE "Flight" RENAME COLUMN "durationMins" TO "durationMinutes";

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN "tailNumberSnapshot" TEXT,
ADD COLUMN "status" "FlightStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "plannedStartTime" TIMESTAMP(3),
ADD COLUMN "plannedEndTime" TIMESTAMP(3),
ADD COLUMN "importedProvider" TEXT,
ADD COLUMN "providerFlightId" TEXT,
ADD COLUMN "autoImportStatus" "AutoImportStatus",
ADD COLUMN "autoImportLastError" TEXT;

-- CreateTable
CREATE TABLE "AccountApprovalToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountApprovalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "costItemId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPoint" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitudeFeet" INTEGER,
    "groundspeedKt" INTEGER,
    "headingDeg" INTEGER,

    CONSTRAINT "TrackPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phase" "ChecklistPhase" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "aircraftTailNumber" TEXT,
    "makeModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "inputType" "ChecklistInputType" NOT NULL DEFAULT 'CHECK',

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightChecklistRun" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "phase" "ChecklistPhase" NOT NULL,
    "status" "ChecklistRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "signatureName" TEXT,
    "signatureIp" TEXT,
    "signatureUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistRunId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "required" BOOLEAN NOT NULL,
    "inputType" "ChecklistInputType" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueYesNo" BOOLEAN,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountApprovalToken_token_key" ON "AccountApprovalToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_userId_importedProvider_providerFlightId_key" ON "Flight"("userId", "importedProvider", "providerFlightId");

-- CreateIndex
CREATE INDEX "TrackPoint_flightId_recordedAt_idx" ON "TrackPoint"("flightId", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_phase_isDefault_idx" ON "ChecklistTemplate"("phase", "isDefault");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_aircraftTailNumber_idx" ON "ChecklistTemplate"("aircraftTailNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FlightChecklistRun_flightId_phase_key" ON "FlightChecklistRun"("flightId", "phase");

-- CreateIndex
CREATE INDEX "FlightChecklistItem_checklistRunId_order_idx" ON "FlightChecklistItem"("checklistRunId", "order");

-- AddForeignKey
ALTER TABLE "AccountApprovalToken" ADD CONSTRAINT "AccountApprovalToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDocument" ADD CONSTRAINT "ReceiptDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDocument" ADD CONSTRAINT "ReceiptDocument_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "Cost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPoint" ADD CONSTRAINT "TrackPoint_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightChecklistRun" ADD CONSTRAINT "FlightChecklistRun_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightChecklistRun" ADD CONSTRAINT "FlightChecklistRun_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightChecklistItem" ADD CONSTRAINT "FlightChecklistItem_checklistRunId_fkey" FOREIGN KEY ("checklistRunId") REFERENCES "FlightChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
