-- Add optional aircraft photo metadata (stored on disk in /uploads)
ALTER TABLE "Aircraft"
ADD COLUMN     "photoStoragePath" TEXT,
ADD COLUMN     "photoOriginalFilename" TEXT,
ADD COLUMN     "photoContentType" TEXT,
ADD COLUMN     "photoSizeBytes" INTEGER;

