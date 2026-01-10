import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getCurrentUser } from "@/app/lib/auth/session";
import { importSchema } from "@/app/lib/validation";
import { getAdsbProvider, defaultProviderName } from "@/app/lib/adsb";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";

const searchSchema = importSchema.extend({
  tailNumber: z.string().min(3)
});

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }

  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }
  if (start > end) {
    return NextResponse.json(
      { error: "Start time must be before end time." },
      { status: 400 }
    );
  }

  const provider = getAdsbProvider();
  let deduped: ReturnType<typeof dedupeImportCandidates>;
  try {
    const flights = await provider.searchFlights(parsed.data.tailNumber.trim(), start, end);
    deduped = dedupeImportCandidates(flights);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ADS-B provider request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
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
