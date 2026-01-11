import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { AeroApiAdsbProvider } from "@/app/lib/adsb/aeroApiProvider";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { handleApiError } from "@/src/lib/security/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const csrf = validateRequestCsrf(request);
    if (!csrf.ok) {
      const origin = new URL(request.url).origin;
      const referer = request.headers.get("referer");
      const refererUrl = referer ? new URL(referer) : null;
      const redirectUrl =
        refererUrl && refererUrl.origin === origin
          ? refererUrl
          : new URL(`/flights/${params.id}`, request.url);
      redirectUrl.searchParams.set("toast", csrf.error ?? "CSRF validation failed.");
      redirectUrl.searchParams.set("toastType", "error");
      return NextResponse.redirect(redirectUrl, { status: 303 });
    }

    const { user, session } = await getCurrentUser();
    if (!user || !session || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const flight = await prisma.flight.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        importedProvider: true,
        providerFlightId: true,
        tailNumber: true,
        tailNumberSnapshot: true,
        startTime: true,
        endTime: true,
        plannedStartTime: true,
        plannedEndTime: true
      }
    });

    if (!flight) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (!flight.importedProvider || !flight.providerFlightId) {
      return NextResponse.json(
        { error: "This flight does not have an ADS-B attachment yet." },
        { status: 400 }
      );
    }

    if (flight.importedProvider !== "aeroapi") {
      return NextResponse.json(
        { error: `Refresh is not supported for provider ${flight.importedProvider}.` },
        { status: 400 }
      );
    }

    const tail = (flight.tailNumberSnapshot ?? flight.tailNumber).trim();
    const baseStart = flight.startTime ?? flight.plannedStartTime ?? new Date();
    const baseEnd = flight.endTime ?? flight.plannedEndTime ?? baseStart;
    const searchStart = new Date(baseStart.getTime() - 6 * 60 * 60 * 1000);
    const searchEnd = new Date(baseEnd.getTime() + 6 * 60 * 60 * 1000);

    const provider = new AeroApiAdsbProvider();
    const candidates = await provider.searchFlights(tail, searchStart, searchEnd);
    const match = candidates.find((c) => c.providerFlightId === flight.providerFlightId);

    if (!match) {
      return NextResponse.json(
        { error: "Could not re-fetch this specific ADS-B track. Try selecting a match again." },
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

    const speedValues = trackPoints
      .map((point) => point.groundspeedKt)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const speedSummary =
      speedValues.length > 0
        ? {
            min: Math.round(Math.min(...speedValues)),
            max: Math.round(Math.max(...speedValues)),
            avg: Math.round(speedValues.reduce((sum, v) => sum + v, 0) / speedValues.length),
            count: speedValues.length
          }
        : null;

    await prisma.$transaction(async (tx) => {
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
      await tx.flight.update({
        where: { id: flight.id },
        data: {
          startTime: match.startTime,
          endTime: match.endTime,
          durationMinutes: match.durationMinutes ? Math.round(match.durationMinutes) : null,
          distanceNm: match.distanceNm ? Math.round(match.distanceNm) : null,
          statsJson: match.stats ? (match.stats as any) : undefined,
          // If we have an endTime from ADS-B, treat as landed/completed.
          status: "COMPLETED"
        }
      });
    });

    const origin = new URL(request.url).origin;
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const redirectUrl =
      refererUrl && refererUrl.origin === origin
        ? refererUrl
        : new URL(`/flights/${flight.id}`, request.url);
    redirectUrl.searchParams.set(
      "toast",
      speedSummary
        ? `ADS-B refreshed. Speed kt min/avg/max: ${speedSummary.min}/${speedSummary.avg}/${speedSummary.max} (${speedSummary.count} pts).`
        : "ADS-B refreshed. No speed values returned by provider."
    );
    redirectUrl.searchParams.set("toastType", "success");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return handleApiError(error, "flight.adsb.refresh");
  }
}

