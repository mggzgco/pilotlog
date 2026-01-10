import { NextResponse } from "next/server";
import { getAdsbProvider } from "@/app/lib/adsb";

// Debug-only endpoint to exercise the ADS-B provider with a specific tail/time range.
// Example:
//   /api/debug/adsb?tail=N246FB&start=2026-01-06T11:30:00Z&beforeHours=4&afterHours=4
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tail = url.searchParams.get("tail") || "N246FB";
    const startParam = url.searchParams.get("start");
    const beforeHours = Number(url.searchParams.get("beforeHours") ?? "4");
    const afterHours = Number(url.searchParams.get("afterHours") ?? "4");

    // Default to 2026-01-06 06:30 EST (11:30 UTC) if not provided
    const defaultStart = new Date("2026-01-06T11:30:00Z");
    const start = startParam ? new Date(startParam) : defaultStart;
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }

    const msBefore = beforeHours * 60 * 60 * 1000;
    const msAfter = afterHours * 60 * 60 * 1000;
    const windowStart = new Date(start.getTime() - msBefore);
    const windowEnd = new Date(start.getTime() + msAfter);

    const provider = getAdsbProvider();
    const flights = await provider.searchFlights(tail, windowStart, windowEnd);

    return NextResponse.json({
      tail,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      count: flights.length,
      flights: flights.map((f) => ({
        providerFlightId: f.providerFlightId,
        tailNumber: f.tailNumber,
        startTime: f.startTime.toISOString(),
        endTime: f.endTime.toISOString(),
        durationMinutes: f.durationMinutes ?? null,
        distanceNm: f.distanceNm ?? null,
        depLabel: f.depLabel,
        arrLabel: f.arrLabel,
        stats: f.stats ?? null,
        trackPoints: f.track.length,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
