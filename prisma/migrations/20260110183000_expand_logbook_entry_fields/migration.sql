-- Expand LogbookEntry to support full pilot logbook fields (hobbs, in/out, additional time buckets, takeoffs/landings)

ALTER TABLE "LogbookEntry"
ADD COLUMN     "timeOut" TEXT,
ADD COLUMN     "timeIn" TEXT,
ADD COLUMN     "hobbsOut" DECIMAL(7,2),
ADD COLUMN     "hobbsIn" DECIMAL(7,2),
ADD COLUMN     "dualReceivedTime" DECIMAL(5,2),
ADD COLUMN     "soloTime" DECIMAL(5,2),
ADD COLUMN     "xcTime" DECIMAL(5,2),
ADD COLUMN     "simulatedInstrumentTime" DECIMAL(5,2),
ADD COLUMN     "simulatorTime" DECIMAL(5,2),
ADD COLUMN     "groundTime" DECIMAL(5,2),
ADD COLUMN     "dayTakeoffs" INTEGER,
ADD COLUMN     "dayLandings" INTEGER,
ADD COLUMN     "nightTakeoffs" INTEGER,
ADD COLUMN     "nightLandings" INTEGER;

