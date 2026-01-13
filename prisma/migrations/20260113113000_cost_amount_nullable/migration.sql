-- PROD FIX: legacy Cost.amount (DECIMAL) is NOT NULL from initial schema.
-- Prisma schema no longer writes this column (we use amountCents), so inserts will fail in prod
-- unless we relax the constraint.

ALTER TABLE "Cost"
  ALTER COLUMN "amount" DROP NOT NULL;

