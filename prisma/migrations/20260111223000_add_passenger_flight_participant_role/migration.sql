-- Add PASSENGER to FlightParticipantRole enum.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'FlightParticipantRole'
      AND e.enumlabel = 'PASSENGER'
  ) THEN
    ALTER TYPE "FlightParticipantRole" ADD VALUE 'PASSENGER';
  END IF;
END $$;

