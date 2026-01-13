-- Add AircraftDocument for storing aircraft-specific files (POH/manuals/etc).

CREATE TABLE IF NOT EXISTS "AircraftDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "aircraftId" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AircraftDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AircraftDocument_userId_idx" ON "AircraftDocument"("userId");
CREATE INDEX IF NOT EXISTS "AircraftDocument_aircraftId_idx" ON "AircraftDocument"("aircraftId");

DO $$ BEGIN
  ALTER TABLE "AircraftDocument"
    ADD CONSTRAINT "AircraftDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AircraftDocument"
    ADD CONSTRAINT "AircraftDocument_aircraftId_fkey"
    FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AircraftDocument_aircraftId_storagePath_key"
  ON "AircraftDocument"("aircraftId", "storagePath");

