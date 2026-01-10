-- CreateEnum
CREATE TYPE "FlightParticipantRole" AS ENUM ('INSTRUCTOR', 'STUDENT', 'PIC', 'SIC');

-- CreateTable
CREATE TABLE "FlightParticipant" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FlightParticipantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlightParticipant_flightId_userId_key" ON "FlightParticipant"("flightId", "userId");
CREATE INDEX "FlightParticipant_flightId_idx" ON "FlightParticipant"("flightId");
CREATE INDEX "FlightParticipant_userId_idx" ON "FlightParticipant"("userId");

-- AddForeignKey
ALTER TABLE "FlightParticipant" ADD CONSTRAINT "FlightParticipant_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightParticipant" ADD CONSTRAINT "FlightParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
