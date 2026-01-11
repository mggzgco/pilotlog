-- Add aircraft photo metadata fields.

ALTER TABLE "Aircraft"
  ADD COLUMN IF NOT EXISTS "photoStoragePath" TEXT,
  ADD COLUMN IF NOT EXISTS "photoOriginalFilename" TEXT,
  ADD COLUMN IF NOT EXISTS "photoContentType" TEXT,
  ADD COLUMN IF NOT EXISTS "photoSizeBytes" INTEGER;

