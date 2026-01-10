ALTER TABLE "Cost"
ADD COLUMN     "rateCents" INTEGER,
ADD COLUMN     "quantityHours" DECIMAL(7, 2),
ADD COLUMN     "fuelGallons" DECIMAL(7, 2),
ADD COLUMN     "fuelPriceCents" INTEGER;
