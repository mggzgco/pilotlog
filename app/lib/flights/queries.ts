import { prisma } from "@/app/lib/db";

export async function getLatestFlightWithTrackPoints(userId: string) {
  // Prefer the latest flight that has something "mappable" (track points or a polyline).
  const latestMappable = await prisma.flight.findFirst({
    where: {
      userId,
      OR: [{ routePolyline: { not: null } }, { trackPoints: { some: {} } }]
    },
    orderBy: { startTime: "desc" },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      stops: { orderBy: { order: "asc" }, select: { label: true } }
    }
  });

  if (latestMappable) return latestMappable;

  // Fallback: newest flight overall (often planned), still useful for route label.
  return prisma.flight.findFirst({
    where: { userId },
    orderBy: { startTime: "desc" },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      stops: { orderBy: { order: "asc" }, select: { label: true } }
    }
  });
}

export async function getRecentFlights(userId: string, take = 10) {
  return prisma.flight.findMany({
    where: { userId },
    orderBy: { startTime: "desc" },
    take,
    select: {
      id: true,
      origin: true,
      destination: true,
      status: true,
      durationMinutes: true,
      distanceNm: true,
      startTime: true,
      endTime: true,
      tailNumber: true,
      tailNumberSnapshot: true
    }
  });
}
