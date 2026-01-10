import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { deriveAutoImportWindow, scoreAutoImportCandidate } from "@/app/lib/flights/auto-import";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
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

  const payload = await request.json().catch(() => ({}));
  const parsed = z
    .object({
      start: z.string().optional(),
      end: z.string().optional()
    })
    .safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid time window." }, { status: 400 });
  }

  const hasCustomWindow = Boolean(parsed.data.start || parsed.data.end);
  if (hasCustomWindow && (!parsed.data.start || !parsed.data.end)) {
    return NextResponse.json({ error: "Start and end time are required." }, { status: 400 });
  }

  const window = deriveAutoImportWindow(flight);
  const customStart = parsed.data.start ? new Date(parsed.data.start) : null;
  const customEnd = parsed.data.end ? new Date(parsed.data.end) : null;

  if (
    hasCustomWindow &&
    (!customStart || !customEnd || Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime()))
  ) {
    return NextResponse.json({ error: "Invalid time window." }, { status: 400 });
  }

  if (customStart && customEnd && customStart > customEnd) {
    return NextResponse.json({ error: "Start time must be before end time." }, { status: 400 });
  }

  const provider = getAdsbProvider();
  let deduped: ReturnType<typeof dedupeImportCandidates>;
  try {
    const flights = await provider.searchFlights(
      tailNumber,
      customStart ?? window.searchStart,
      customEnd ?? window.searchEnd
    );
    deduped = dedupeImportCandidates(flights);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ADS-B provider request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (customStart && customEnd) {
    deduped.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  } else {
    deduped.sort(
      (a, b) =>
        scoreAutoImportCandidate(
          window.referenceStart,
          window.referenceEnd,
          a.startTime,
          a.endTime
        ) -
        scoreAutoImportCandidate(
          window.referenceStart,
          window.referenceEnd,
          b.startTime,
          b.endTime
        )
    );
  }

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
