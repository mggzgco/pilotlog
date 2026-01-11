-- CreateEnum
CREATE TYPE "ChecklistDecision" AS ENUM ('ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "FlightChecklistRun" ADD COLUMN "decision" "ChecklistDecision",
ADD COLUMN "decisionNote" TEXT;
