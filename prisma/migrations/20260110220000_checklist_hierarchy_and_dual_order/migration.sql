-- Add hierarchy + dual ordering for checklists (template + flight snapshots)

DO $$ BEGIN
  CREATE TYPE "ChecklistItemKind" AS ENUM ('SECTION', 'STEP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ChecklistTemplateItem"
  ADD COLUMN IF NOT EXISTS "kind" "ChecklistItemKind" NOT NULL DEFAULT 'STEP',
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "officialOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "personalOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "ChecklistTemplateItem"
SET
  "officialOrder" = COALESCE("officialOrder", 0),
  "personalOrder" = COALESCE("personalOrder", 0);

-- Backfill dual orders from legacy "order" if the new orders are still 0.
UPDATE "ChecklistTemplateItem"
SET
  "officialOrder" = "order",
  "personalOrder" = "order"
WHERE "officialOrder" = 0 AND "personalOrder" = 0;

DO $$ BEGIN
  ALTER TABLE "ChecklistTemplateItem"
    ADD CONSTRAINT "ChecklistTemplateItem_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ChecklistTemplateItem"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FlightChecklistItem"
  ADD COLUMN IF NOT EXISTS "kind" "ChecklistItemKind" NOT NULL DEFAULT 'STEP',
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "officialOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "personalOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill dual orders from legacy "order" if the new orders are still 0.
UPDATE "FlightChecklistItem"
SET
  "officialOrder" = "order",
  "personalOrder" = "order"
WHERE "officialOrder" = 0 AND "personalOrder" = 0;

DO $$ BEGIN
  ALTER TABLE "FlightChecklistItem"
    ADD CONSTRAINT "FlightChecklistItem_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "FlightChecklistItem"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

