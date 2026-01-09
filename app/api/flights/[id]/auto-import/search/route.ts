import { NextResponse } from "next/server";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { deriveAutoImportWindow } from "@/app/lib/flights/auto-import";

function candidateScore(
  referenceStart: Date,
  referenceEnd: Date,
  candidateStart: Date,
  candidateEnd: Date
) {
  const startDiff = Math.abs(candidateStart.getTime() - referenceStart.getTime());
  const endDiff = Math.abs(candidateEnd.getTime() - referenceEnd.getTime());
  return startDiff + endDiff;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const { user } = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

  const tailNumber = flight.tailNumberSnapshot?.trim() || flight.tailNumber?.trim();
  if (!tailNumber) {
    return NextResponse.json({ error: "Flight tail number is missing." }, { status: 400 });
  }

  const window = deriveAutoImportWindow(flight);
  const provider = getAdsbProvider();
  const flights = await provider.searchFlights(
    tailNumber,
    window.searchStart,
    window.searchEnd
  );

  const deduped = dedupeImportCandidates(flights);
  deduped.sort(
    (a, b) =>
      candidateScore(window.referenceStart, window.referenceEnd, a.startTime, a.endTime) -
      candidateScore(window.referenceStart, window.referenceEnd, b.startTime, b.endTime)
  );

  return NextResponse.json({
    provider: defaultProviderName,
    flights: deduped.map((flight) => ({
      providerFlightId: flight.providerFlightId,
      tailNumber: flight.tailNumber,
      startTime: flight.startTime.toISOString(),
      endTime: flight.endTime.toISOString(),
      durationMinutes: flight.durationMinutes ?? null,
      distanceNm: flight.distanceNm ?? null,
      depLabel: flight.depLabel,
      arrLabel: flight.arrLabel,
      stats: flight.stats ?? null,
      track: flight.track.map((point) => ({
        recordedAt: point.recordedAt.toISOString(),
        latitude: point.latitude,
        longitude: point.longitude,
        altitudeFeet: point.altitudeFeet ?? null,
        groundspeedKt: point.groundspeedKt ?? null,
        headingDeg: point.headingDeg ?? null
      }))
    }))
  });
}
