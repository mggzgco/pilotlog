-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

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

-- CreateEnum
CREATE TYPE "ChecklistDecision" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FlightParticipantRole" AS ENUM ('INSTRUCTOR', 'STUDENT', 'PIC', 'SIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aircraftId" TEXT,
    "tailNumber" TEXT NOT NULL,
    "tailNumberSnapshot" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT,
    "status" "FlightStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStartTime" TIMESTAMP(3),
    "plannedEndTime" TIMESTAMP(3),
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "distanceNm" INTEGER,
    "routePolyline" TEXT,
    "statsJson" JSONB,
    "importedProvider" TEXT,
    "providerFlightId" TEXT,
    "autoImportStatus" "AutoImportStatus",
    "autoImportLastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightParticipant" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FlightParticipantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightPersonParticipant" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "FlightParticipantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightPersonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aircraftTypeId" TEXT,
    "tailNumber" TEXT NOT NULL,
    "model" TEXT,
    "preflightChecklistTemplateId" TEXT,
    "postflightChecklistTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "LogbookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flightId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "totalTime" DECIMAL(5,2),
    "picTime" DECIMAL(5,2),
    "sicTime" DECIMAL(5,2),
    "nightTime" DECIMAL(5,2),
    "instrumentTime" DECIMAL(5,2),
    "remarks" TEXT,

    CONSTRAINT "LogbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flightId" TEXT,
    "category" TEXT NOT NULL,
    "rateCents" INTEGER,
    "quantityHours" DECIMAL(7,2),
    "fuelGallons" DECIMAL(7,2),
    "fuelPriceCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "vendor" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
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
CREATE TABLE "AccountApprovalToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountApprovalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phase" "ChecklistPhase" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
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
    "decision" "ChecklistDecision",
    "decisionNote" TEXT,
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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Flight_aircraftId_idx" ON "Flight"("aircraftId");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_userId_importedProvider_providerFlightId_key" ON "Flight"("userId", "importedProvider", "providerFlightId");

-- CreateIndex
CREATE INDEX "FlightParticipant_flightId_idx" ON "FlightParticipant"("flightId");

-- CreateIndex
CREATE INDEX "FlightParticipant_userId_idx" ON "FlightParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlightParticipant_flightId_userId_key" ON "FlightParticipant"("flightId", "userId");

-- CreateIndex
CREATE INDEX "FlightPersonParticipant_flightId_idx" ON "FlightPersonParticipant"("flightId");

-- CreateIndex
CREATE INDEX "FlightPersonParticipant_personId_idx" ON "FlightPersonParticipant"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "FlightPersonParticipant_flightId_personId_key" ON "FlightPersonParticipant"("flightId", "personId");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "Aircraft_aircraftTypeId_idx" ON "Aircraft"("aircraftTypeId");

-- CreateIndex
CREATE INDEX "Aircraft_preflightChecklistTemplateId_idx" ON "Aircraft"("preflightChecklistTemplateId");

-- CreateIndex
CREATE INDEX "Aircraft_postflightChecklistTemplateId_idx" ON "Aircraft"("postflightChecklistTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_userId_tailNumber_key" ON "Aircraft"("userId", "tailNumber");

-- CreateIndex
CREATE INDEX "AircraftType_userId_idx" ON "AircraftType"("userId");

-- CreateIndex
CREATE INDEX "AircraftType_defaultPreflightTemplateId_idx" ON "AircraftType"("defaultPreflightTemplateId");

-- CreateIndex
CREATE INDEX "AircraftType_defaultPostflightTemplateId_idx" ON "AircraftType"("defaultPostflightTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "AircraftType_userId_name_key" ON "AircraftType"("userId", "name");

-- CreateIndex
CREATE INDEX "TrackPoint_flightId_recordedAt_idx" ON "TrackPoint"("flightId", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountApprovalToken_tokenHash_key" ON "AccountApprovalToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_phase_isDefault_idx" ON "ChecklistTemplate"("phase", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "FlightChecklistRun_flightId_phase_key" ON "FlightChecklistRun"("flightId", "phase");

-- CreateIndex
CREATE INDEX "FlightChecklistItem_checklistRunId_order_idx" ON "FlightChecklistItem"("checklistRunId", "order");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightParticipant" ADD CONSTRAINT "FlightParticipant_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightParticipant" ADD CONSTRAINT "FlightParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightPersonParticipant" ADD CONSTRAINT "FlightPersonParticipant_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightPersonParticipant" ADD CONSTRAINT "FlightPersonParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_preflightChecklistTemplateId_fkey" FOREIGN KEY ("preflightChecklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_postflightChecklistTemplateId_fkey" FOREIGN KEY ("postflightChecklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_defaultPreflightTemplateId_fkey" FOREIGN KEY ("defaultPreflightTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_defaultPostflightTemplateId_fkey" FOREIGN KEY ("defaultPostflightTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookEntry" ADD CONSTRAINT "LogbookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookEntry" ADD CONSTRAINT "LogbookEntry_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDocument" ADD CONSTRAINT "ReceiptDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDocument" ADD CONSTRAINT "ReceiptDocument_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDocument" ADD CONSTRAINT "ReceiptDocument_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "Cost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPoint" ADD CONSTRAINT "TrackPoint_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountApprovalToken" ADD CONSTRAINT "AccountApprovalToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
