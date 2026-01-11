-- Airport reference data + optional links from flights to airports.

CREATE TABLE IF NOT EXISTS "Airport" (
  "id" TEXT NOT NULL,
  "icao" TEXT NOT NULL,
  "iata" TEXT,
  "name" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "timeZone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Airport_icao_key" ON "Airport"("icao");
CREATE INDEX IF NOT EXISTS "Airport_iata_idx" ON "Airport"("iata");
CREATE INDEX IF NOT EXISTS "Airport_timeZone_idx" ON "Airport"("timeZone");

ALTER TABLE "Flight"
  ADD COLUMN IF NOT EXISTS "originAirportId" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationAirportId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Flight"
    ADD CONSTRAINT "Flight_originAirportId_fkey"
    FOREIGN KEY ("originAirportId") REFERENCES "Airport"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Flight"
    ADD CONSTRAINT "Flight_destinationAirportId_fkey"
    FOREIGN KEY ("destinationAirportId") REFERENCES "Airport"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Flight_originAirportId_idx" ON "Flight"("originAirportId");
CREATE INDEX IF NOT EXISTS "Flight_destinationAirportId_idx" ON "Flight"("destinationAirportId");

