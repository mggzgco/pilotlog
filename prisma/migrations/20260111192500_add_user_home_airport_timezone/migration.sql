-- Add user home airport + home timezone for flight defaults.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "homeAirport" TEXT,
  ADD COLUMN IF NOT EXISTS "homeTimeZone" TEXT;

