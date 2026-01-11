-- Align Cost table with current schema: add amountCents + vendor/notes/category fields.
-- Backfill amountCents from legacy decimal "amount" when present.

ALTER TABLE "Cost"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "amountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "vendor" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Backfill amountCents from legacy amount (DECIMAL(10,2)).
-- If amount is NULL (shouldn't be), leave amountCents NULL for now.
UPDATE "Cost"
SET "amountCents" = ROUND(("amount" * 100))::INTEGER
WHERE "amountCents" IS NULL AND "amount" IS NOT NULL;

-- Make amountCents required going forward. Use 0 as a safe fallback if some rows are still null.
UPDATE "Cost"
SET "amountCents" = 0
WHERE "amountCents" IS NULL;

ALTER TABLE "Cost"
  ALTER COLUMN "amountCents" SET NOT NULL;

