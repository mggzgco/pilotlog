-- Add people directory + linking participants to flights.
-- These tables are referenced by the Prisma schema but were missing from the migration history.

CREATE TABLE IF NOT EXISTS "Person" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Person_userId_idx" ON "Person"("userId");

DO $$ BEGIN
  ALTER TABLE "Person"
    ADD CONSTRAINT "Person_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FlightPersonParticipant" (
  "id" TEXT NOT NULL,
  "flightId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "role" "FlightParticipantRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlightPersonParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlightPersonParticipant_flightId_personId_key"
  ON "FlightPersonParticipant"("flightId", "personId");
CREATE INDEX IF NOT EXISTS "FlightPersonParticipant_flightId_idx"
  ON "FlightPersonParticipant"("flightId");
CREATE INDEX IF NOT EXISTS "FlightPersonParticipant_personId_idx"
  ON "FlightPersonParticipant"("personId");

DO $$ BEGIN
  ALTER TABLE "FlightPersonParticipant"
    ADD CONSTRAINT "FlightPersonParticipant_flightId_fkey"
    FOREIGN KEY ("flightId") REFERENCES "Flight"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlightPersonParticipant"
    ADD CONSTRAINT "FlightPersonParticipant_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

