import { NextResponse } from "next/server";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { aeroApiProviderName } from "@/app/lib/adsb/aeroApiProvider";

// Debug-only endpoint to exercise the ADS-B provider with a specific tail/time range.
// Example:
//   /api/debug/adsb?tail=N246FB&start=2026-01-06T11:30:00Z&beforeHours=4&afterHours=4
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Default to the specific flight you provided:
    // N246FB on 2026-01-08 at 12:42Z (FlightAware link: 20260108/1242Z/KLOM/KLOM).
    const tail = url.searchParams.get("tail") || "N246FB";
    const startParam = url.searchParams.get("start");
    const beforeHours = Number(url.searchParams.get("beforeHours") ?? "12");
    const afterHours = Number(url.searchParams.get("afterHours") ?? "12");

    // Default to 2026-01-08 12:00Z (07:00 EST) if not provided
    const defaultStart = new Date("2026-01-08T12:00:00Z");
    const start = startParam ? new Date(startParam) : defaultStart;
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }

    const msBefore = beforeHours * 60 * 60 * 1000;
    const msAfter = afterHours * 60 * 60 * 1000;
    const windowStart = new Date(start.getTime() - msBefore);
    const windowEnd = new Date(start.getTime() + msAfter);
    const epochStart = Math.floor(windowStart.getTime() / 1000);
    const epochEnd = Math.floor(windowEnd.getTime() / 1000);

    const provider = getAdsbProvider();

    const offsetMs = start.getTimezoneOffset() * 60 * 1000;
    const windows = [
      { label: "primary", start: windowStart, end: windowEnd },
      {
        label: "offset",
        start: new Date(windowStart.getTime() + offsetMs),
        end: new Date(windowEnd.getTime() + offsetMs)
      },
      {
        label: "primary-24h",
        start: new Date(start.getTime() - 24 * 60 * 60 * 1000),
        end: new Date(start.getTime() + 24 * 60 * 60 * 1000)
      },
      {
        label: "offset-24h",
        start: new Date(start.getTime() + offsetMs - 24 * 60 * 60 * 1000),
        end: new Date(start.getTime() + offsetMs + 24 * 60 * 60 * 1000)
      }
    ];

    const results: Array<{
      label: string;
      windowStart: string;
      windowEnd: string;
      count: number;
      error?: string;
    }> = [];
    const mergedMap = new Map<string, Awaited<ReturnType<typeof provider.searchFlights>>[number]>();

    for (const w of windows) {
      try {
        const found = await provider.searchFlights(tail, w.start, w.end);
        results.push({
          label: w.label,
          windowStart: w.start.toISOString(),
          windowEnd: w.end.toISOString(),
          count: found.length
        });
        for (const f of found) {
          mergedMap.set(f.providerFlightId, f);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.push({
          label: w.label,
          windowStart: w.start.toISOString(),
          windowEnd: w.end.toISOString(),
          count: 0,
          error: message
        });
      }
    }

    const merged = [...mergedMap.values()];

    // Direct AeroAPI raw probes (only when using AeroAPI provider)
    let raw: Record<
      string,
      {
        status?: number;
        error?: string;
        count?: number;
        sampleId?: string | null;
        url?: string;
        query?: string;
        note?: string;
      }
    > | null = null;
    if (defaultProviderName === aeroApiProviderName) {
      const apiKey = process.env.AEROAPI_KEY?.trim();
      const apiBase = process.env.AEROAPI_API_BASE ?? "https://aeroapi.flightaware.com/aeroapi";
      if (apiKey) {
        raw = {};
        const headers = { "x-apikey": apiKey };
        const primaryUrl = new URL(`/flights/${encodeURIComponent(tail)}`, apiBase);
        primaryUrl.searchParams.set("start", Math.floor(windowStart.getTime() / 1000).toString());
        primaryUrl.searchParams.set("end", Math.floor(windowEnd.getTime() / 1000).toString());
        primaryUrl.searchParams.set("max_pages", "5");

        const searchUrl = new URL("/search/flights", apiBase);
        const searchQuery = `-idents ${tail} -begin ${epochStart} -end ${epochEnd}`;
        searchUrl.searchParams.set("query", searchQuery);
        searchUrl.searchParams.set("max_pages", "5");

        const historyUrl = new URL(`/history/flights/${encodeURIComponent(tail)}`, apiBase);
        historyUrl.searchParams.set("ident_type", "registration");
        historyUrl.searchParams.set("start", windowStart.toISOString());
        historyUrl.searchParams.set("end", windowEnd.toISOString());
        historyUrl.searchParams.set("max_pages", "5");

        const probe = async (label: string, url: URL, opts: { note?: string; query?: string } = {}) => {
          try {
            const res = await fetch(url.toString(), { headers });
            const json = await res.json().catch(() => ({}));
            const flights = Array.isArray(json.flights) ? json.flights : [];
            raw![label] = {
              status: res.status,
              count: flights.length,
              sampleId: flights[0]?.fa_flight_id ?? flights[0]?.ident ?? null,
              url: url.toString(),
              query: opts.query,
              note: opts.note
            };
          } catch (error) {
            raw![label] = {
              error: error instanceof Error ? error.message : "Unknown error",
              url: url.toString(),
              query: opts.query,
              note: opts.note
            };
          }
        };

        await probe("history_direct", historyUrl, { note: "registration history" });
        await probe("primary_direct", primaryUrl, { note: "/flights ident lookup" });
        await probe("search_direct", searchUrl, { query: searchQuery, note: "/search/flights ident query" });

        // Extra ident variants for search
        const searchVariants = [
          `-ident ${tail} -begin ${epochStart} -end ${epochEnd}`,
          `-idents ${tail}`,
          `-ident ${tail}`
        ];
        for (const [idx, q] of searchVariants.entries()) {
          const urlVariant = new URL("/search/flights", apiBase);
          urlVariant.searchParams.set("query", q);
          urlVariant.searchParams.set("max_pages", "5");
          await probe(`search_direct_variant_${idx + 1}`, urlVariant, {
            query: q,
            note: "/search/flights variant"
          });
        }
      }
    }

    return NextResponse.json({
      tail,
      provider: defaultProviderName,
      windowEpoch: { start: epochStart, end: epochEnd },
      windows: results,
      mergedCount: merged.length,
      flights: merged.map((f) => ({
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
      raw
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
