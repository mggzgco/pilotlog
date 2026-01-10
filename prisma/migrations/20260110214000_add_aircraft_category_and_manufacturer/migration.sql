-- CreateEnum
CREATE TYPE "AircraftCategory" AS ENUM (
  'SINGLE_ENGINE_PISTON',
  'MULTI_ENGINE_PISTON',
  'SINGLE_ENGINE_TURBINE',
  'MULTI_ENGINE_TURBINE',
  'JET',
  'GLIDER',
  'HELICOPTER',
  'OTHER'
);

-- AlterTable
ALTER TABLE "Aircraft"
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "category" "AircraftCategory" NOT NULL DEFAULT 'OTHER';

