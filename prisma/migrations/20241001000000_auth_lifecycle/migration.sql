-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "User"
SET "status" = CASE
  WHEN "approved" = true THEN 'ACTIVE'::"UserStatus"
  ELSE 'PENDING'::"UserStatus"
END;

ALTER TABLE "User" DROP COLUMN "approved";

-- AlterTable
ALTER TABLE "AccountApprovalToken" RENAME COLUMN "token" TO "tokenHash";
ALTER TABLE "AccountApprovalToken" DROP COLUMN "usedAt";
