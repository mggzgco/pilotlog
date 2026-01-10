ALTER TABLE "Cost"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "rateCents" INTEGER,
ADD COLUMN "quantityHours" DECIMAL(7,2),
ADD COLUMN "fuelGallons" DECIMAL(7,2),
ADD COLUMN "fuelPriceCents" INTEGER,
ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "vendor" TEXT,
ADD COLUMN "notes" TEXT;

UPDATE "Cost"
SET "amountCents" = ROUND("amount" * 100)::INTEGER
WHERE "amount" IS NOT NULL;
