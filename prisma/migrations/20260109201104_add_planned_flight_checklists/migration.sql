-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('PREFLIGHT', 'POSTFLIGHT');

-- CreateEnum
CREATE TYPE "AdsbMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'AMBIGUOUS', 'MISSING');

-- CreateTable
CREATE TABLE "PlannedFlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tailNumber" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3),
    "preflightSignedAt" TIMESTAMP(3),
    "preflightSignedBy" TEXT,
    "postflightSignedAt" TIMESTAMP(3),
    "postflightSignedBy" TEXT,
    "postflightStartedAt" TIMESTAMP(3),
    "adsbMatchStatus" "AdsbMatchStatus" NOT NULL DEFAULT 'PENDING',
    "adsbCandidates" JSONB,
    "flightId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedChecklistItem" (
    "id" TEXT NOT NULL,
    "plannedFlightId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "PlannedChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedChecklistItem_plannedFlightId_idx" ON "PlannedChecklistItem"("plannedFlightId");

-- AddForeignKey
ALTER TABLE "PlannedFlight" ADD CONSTRAINT "PlannedFlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedFlight" ADD CONSTRAINT "PlannedFlight_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedChecklistItem" ADD CONSTRAINT "PlannedChecklistItem_plannedFlightId_fkey" FOREIGN KEY ("plannedFlightId") REFERENCES "PlannedFlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
