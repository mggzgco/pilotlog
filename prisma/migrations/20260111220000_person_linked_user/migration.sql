-- Allow a "Person" entry in a user's profile to link to an existing User account by email.

ALTER TABLE "Person"
  ADD COLUMN IF NOT EXISTS "linkedUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Person_linkedUserId_idx" ON "Person"("linkedUserId");

DO $$ BEGIN
  ALTER TABLE "Person"
    ADD CONSTRAINT "Person_linkedUserId_fkey"
    FOREIGN KEY ("linkedUserId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

