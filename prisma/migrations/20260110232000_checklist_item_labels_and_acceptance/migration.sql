-- Add "item" + "acceptance criteria" fields for checklist steps (templates + flight snapshots)

ALTER TABLE "ChecklistTemplateItem"
  ADD COLUMN IF NOT EXISTS "itemLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptanceCriteria" TEXT;

ALTER TABLE "FlightChecklistItem"
  ADD COLUMN IF NOT EXISTS "itemLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptanceCriteria" TEXT;

-- Best-effort backfill: if existing step items have no itemLabel, copy from title.
UPDATE "ChecklistTemplateItem"
SET "itemLabel" = "title"
WHERE "kind" = 'STEP' AND ("itemLabel" IS NULL OR "itemLabel" = '');

UPDATE "FlightChecklistItem"
SET "itemLabel" = "title"
WHERE "kind" = 'STEP' AND ("itemLabel" IS NULL OR "itemLabel" = '');

