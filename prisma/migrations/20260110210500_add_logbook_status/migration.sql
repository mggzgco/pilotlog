-- CreateEnum
CREATE TYPE "LogbookEntryStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "LogbookEntry"
ADD COLUMN     "status" "LogbookEntryStatus" NOT NULL DEFAULT 'OPEN';

