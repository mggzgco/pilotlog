-- ReceiptDocument originally existed without `flightId` (only `costItemId`).
-- The current Prisma schema requires `flightId` and Flight.receiptDocuments queries rely on it.

ALTER TABLE "ReceiptDocument"
  ADD COLUMN IF NOT EXISTS "flightId" TEXT;

-- Backfill flightId from the linked cost item, when present.
UPDATE "ReceiptDocument" rd
SET "flightId" = c."flightId"
FROM "Cost" c
WHERE rd."costItemId" = c."id"
  AND rd."flightId" IS NULL;

-- If any rows still have NULL flightId, they cannot satisfy the new schema.
-- Prefer deleting orphan receipts over leaving required fields null (Prisma will error).
DELETE FROM "ReceiptDocument"
WHERE "flightId" IS NULL;

-- Enforce NOT NULL for Prisma-required field (only if still nullable).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReceiptDocument'
      AND column_name = 'flightId'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "ReceiptDocument" ALTER COLUMN "flightId" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ReceiptDocument_flightId_idx" ON "ReceiptDocument"("flightId");

DO $$ BEGIN
  ALTER TABLE "ReceiptDocument"
    ADD CONSTRAINT "ReceiptDocument_flightId_fkey"
    FOREIGN KEY ("flightId") REFERENCES "Flight"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

