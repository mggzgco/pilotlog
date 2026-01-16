-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerUserId" TEXT,
    "username" TEXT,
    "name" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightShareLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FlightShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XAccount_userId_key" ON "XAccount"("userId");

-- CreateIndex
CREATE INDEX "XAccount_providerUserId_idx" ON "XAccount"("providerUserId");

-- CreateIndex
CREATE INDEX "XAccount_username_idx" ON "XAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "FlightShareLink_token_key" ON "FlightShareLink"("token");

-- CreateIndex
CREATE INDEX "FlightShareLink_flightId_idx" ON "FlightShareLink"("flightId");

-- CreateIndex
CREATE INDEX "FlightShareLink_userId_idx" ON "FlightShareLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlightShareLink_userId_flightId_key" ON "FlightShareLink"("userId", "flightId");

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightShareLink" ADD CONSTRAINT "FlightShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightShareLink" ADD CONSTRAINT "FlightShareLink_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
