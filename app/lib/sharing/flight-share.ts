import { prisma } from "@/app/lib/db";

export function buildFlightShareText({
  tailNumber,
  routeLabel,
  durationMinutes,
  distanceNm,
  maxAltitudeFt,
  maxSpeedKt,
  shareUrl
}: {
  tailNumber: string;
  routeLabel: string;
  durationMinutes: number | null;
  distanceNm: number | null;
  maxAltitudeFt: number | null;
  maxSpeedKt: number | null;
  shareUrl: string;
}) {
  const bits: string[] = [];
  bits.push(`FlightTraks ✈️ ${tailNumber}`);
  bits.push(routeLabel);

  const stats: string[] = [];
  if (durationMinutes !== null) stats.push(`${durationMinutes} min`);
  if (distanceNm !== null) stats.push(`${distanceNm} nm`);
  if (maxAltitudeFt !== null) stats.push(`max ${maxAltitudeFt.toLocaleString()} ft`);
  if (maxSpeedKt !== null) stats.push(`max ${maxSpeedKt} kt`);
  if (stats.length > 0) bits.push(stats.join(" · "));

  bits.push(shareUrl);
  return bits.join("\n");
}

export async function getOrCreateFlightShareToken({
  userId,
  flightId
}: {
  userId: string;
  flightId: string;
}) {
  const existing = await prisma.flightShareLink.findFirst({
    where: { userId, flightId, revokedAt: null },
    select: { token: true }
  });
  if (existing) return existing.token;

  const token = crypto.randomUUID().replace(/-/g, "");
  await prisma.flightShareLink.create({
    data: { userId, flightId, token }
  });
  return token;
}

