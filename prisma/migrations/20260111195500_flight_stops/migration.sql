-- Add intermediate stops ("waypoints") for flights.

CREATE TABLE IF NOT EXISTS "FlightStop" (
  "id" TEXT NOT NULL,
  "flightId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "airportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlightStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlightStop_flightId_order_key" ON "FlightStop"("flightId", "order");
CREATE INDEX IF NOT EXISTS "FlightStop_flightId_idx" ON "FlightStop"("flightId");
CREATE INDEX IF NOT EXISTS "FlightStop_airportId_idx" ON "FlightStop"("airportId");

DO $$ BEGIN
  ALTER TABLE "FlightStop"
    ADD CONSTRAINT "FlightStop_flightId_fkey"
    FOREIGN KEY ("flightId") REFERENCES "Flight"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlightStop"
    ADD CONSTRAINT "FlightStop_airportId_fkey"
    FOREIGN KEY ("airportId") REFERENCES "Airport"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

