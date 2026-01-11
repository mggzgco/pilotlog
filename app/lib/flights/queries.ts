import { prisma } from "@/app/lib/db";

export async function getLatestFlightWithTrackPoints(userId: string) {
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
      durationMinutes: true,
      distanceNm: true,
      startTime: true,
      endTime: true,
      tailNumber: true
    }
  });
}
