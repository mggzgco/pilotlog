import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { computeDistanceNm, computeDurationMinutes } from "@/app/lib/flights/compute";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { deriveAutoImportWindow } from "@/app/lib/flights/auto-import";
import { handleApiError } from "@/src/lib/security/errors";

const attachSchema = z.object({
  provider: z.string().min(1),
  providerFlightId: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const csrf = validateRequestCsrf(request);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const { user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = attachSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid flight selection." }, { status: 400 });
    }

    const { provider, providerFlightId } = parsed.data;
    if (provider !== defaultProviderName) {
      return NextResponse.json({ error: "Unsupported ADS-B provider." }, { status: 400 });
    }

    const flight = await prisma.flight.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        checklistRuns: {
          select: { phase: true, signedAt: true }
        }
      }
    });

    if (!flight) {
      return NextResponse.json({ error: "Flight not found." }, { status: 404 });
    }

    const existing = await prisma.flight.findFirst({
      where: {
        userId: user.id,
        importedProvider: provider,
        providerFlightId,
        NOT: { id: flight.id }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: "That ADS-B flight is already attached to another flight." },
        { status: 409 }
      );
    }

    const tailNumber = flight.tailNumberSnapshot?.trim() || flight.tailNumber?.trim();
    if (!tailNumber) {
      return NextResponse.json(
        { error: "Flight tail number is missing." },
        { status: 400 }
      );
    }

    const window = deriveAutoImportWindow(flight);
    const providerClient = getAdsbProvider();
    const candidates = dedupeImportCandidates(
      await providerClient.searchFlights(tailNumber, window.searchStart, window.searchEnd)
    );
    const match = candidates.find(
      (candidate) => candidate.providerFlightId === providerFlightId
    );

    if (!match) {
      return NextResponse.json(
        { error: "Selected ADS-B flight was not found." },
        { status: 404 }
      );
    }

    const trackPoints = match.track
      .map((point) => ({
        recordedAt: point.recordedAt,
        latitude: point.latitude,
        longitude: point.longitude,
        altitudeFeet: point.altitudeFeet ?? null,
        groundspeedKt: point.groundspeedKt ?? null,
        headingDeg: point.headingDeg ?? null
      }))
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

    const durationMinutes =
      match.durationMinutes ??
      computeDurationMinutes(match.startTime, match.endTime, trackPoints);
    const distanceNm = match.distanceNm ?? computeDistanceNm(trackPoints);
    const roundedDuration = durationMinutes ? Math.round(durationMinutes) : null;
    const roundedDistance = distanceNm ? Math.round(distanceNm) : null;
    const totalTimeHours =
      durationMinutes !== null && durationMinutes !== undefined
        ? Math.round((durationMinutes / 60) * 100) / 100
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.trackPoint.deleteMany({ where: { flightId: flight.id } });

      if (trackPoints.length > 0) {
        await tx.trackPoint.createMany({
          data: trackPoints.map((point) => ({
            flightId: flight.id,
            recordedAt: point.recordedAt,
            latitude: point.latitude,
            longitude: point.longitude,
            altitudeFeet: point.altitudeFeet,
            groundspeedKt: point.groundspeedKt,
            headingDeg: point.headingDeg
          }))
        });
      }

      const updatedFlight = await tx.flight.update({
        where: { id: flight.id },
        data: {
          importedProvider: provider,
          providerFlightId,
          startTime: match.startTime,
          endTime: match.endTime,
          durationMinutes: roundedDuration,
          distanceNm: roundedDistance,
          origin: match.depLabel,
          destination: match.arrLabel,
          statsJson: match.stats ?? null,
          status: "IMPORTED",
          autoImportStatus: "MATCHED"
        }
      });

      const logbookEntry = await tx.logbookEntry.findFirst({
        where: { flightId: flight.id }
      });

      if (!logbookEntry) {
        await tx.logbookEntry.create({
          data: {
            userId: user.id,
            flightId: flight.id,
            date: match.startTime,
            totalTime: totalTimeHours
          }
        });
      } else if (logbookEntry.totalTime === null && totalTimeHours !== null) {
        await tx.logbookEntry.update({
          where: { id: logbookEntry.id },
          data: { totalTime: totalTimeHours }
        });
      }

      return updatedFlight;
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return handleApiError(error, "auto-import.attach");
  }
}
