import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { computeDistanceNm, computeDurationMinutes } from "@/app/lib/flights/compute";

const trackPointSchema = z.object({
  recordedAt: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  altitudeFeet: z.number().nullable().optional(),
  groundspeedKt: z.number().nullable().optional(),
  headingDeg: z.number().nullable().optional()
});

const candidateSchema = z.object({
  providerFlightId: z.string().min(1),
  tailNumber: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMinutes: z.number().nullable().optional(),
  distanceNm: z.number().nullable().optional(),
  depLabel: z.string().min(1),
  arrLabel: z.string().min(1),
  stats: z
    .object({
      maxAltitudeFeet: z.number().nullable().optional(),
      maxGroundspeedKt: z.number().nullable().optional()
    })
    .nullable()
    .optional(),
  track: z.array(trackPointSchema).min(2)
});

const saveSchema = z.object({
  provider: z.string().min(1),
  candidate: candidateSchema
});

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const { user } = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid flight selection." }, { status: 400 });
  }

  const { provider, candidate } = parsed.data;
  const existing = await prisma.flight.findFirst({
    where: {
      userId: user.id,
      importedProvider: provider,
      providerFlightId: candidate.providerFlightId
    }
  });

  if (existing) {
    return NextResponse.json({ error: "Flight already imported." }, { status: 409 });
  }

  const startTime = new Date(candidate.startTime);
  const endTime = new Date(candidate.endTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return NextResponse.json({ error: "Invalid flight times." }, { status: 400 });
  }

  const trackPoints = candidate.track
    .map((point) => ({
      recordedAt: new Date(point.recordedAt),
      latitude: point.latitude,
      longitude: point.longitude,
      altitudeFeet: point.altitudeFeet ?? null,
      groundspeedKt: point.groundspeedKt ?? null,
      headingDeg: point.headingDeg ?? null
    }))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const durationMinutes =
    candidate.durationMinutes ??
    computeDurationMinutes(startTime, endTime, trackPoints);
  const distanceNm = candidate.distanceNm ?? computeDistanceNm(trackPoints);

  const flight = await prisma.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        userId: user.id,
        tailNumber: candidate.tailNumber,
        origin: candidate.depLabel,
        destination: candidate.arrLabel,
        startTime,
        endTime,
        durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
        distanceNm: distanceNm ? Math.round(distanceNm) : null,
        status: "IMPORTED",
        importedProvider: provider,
        providerFlightId: candidate.providerFlightId,
        statsJson: candidate.stats ?? null
      }
    });

    await tx.trackPoint.createMany({
      data: trackPoints.map((point) => ({
        flightId: created.id,
        recordedAt: point.recordedAt,
        latitude: point.latitude,
        longitude: point.longitude,
        altitudeFeet: point.altitudeFeet,
        groundspeedKt: point.groundspeedKt,
        headingDeg: point.headingDeg
      }))
    });

    await tx.logbookEntry.create({
      data: {
        userId: user.id,
        flightId: created.id,
        date: startTime
      }
    });

    return created;
  });

  return NextResponse.json({ id: flight.id });
}
