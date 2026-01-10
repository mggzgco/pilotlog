import type { AdsbProvider } from "@/app/lib/adsb/provider";
import type { FlightCandidate, FlightTrackPoint } from "@/app/lib/adsb/types";
import { computeDistanceNm, computeDurationMinutes } from "@/app/lib/flights/compute";

const AEROAPI_PROVIDER_NAME = "aeroapi";
const AEROAPI_API_BASE =
  process.env.AEROAPI_API_BASE ?? "https://aeroapi.flightaware.com/aeroapi";

type AeroApiFlightSummary = {
  fa_flight_id?: string | null;
  ident?: string | null;
  origin?: { code?: string | null; icao?: string | null; iata?: string | null } | string | null;
  destination?:
    | { code?: string | null; icao?: string | null; iata?: string | null }
    | string
    | null;
  // AeroAPI commonly returns ISO8601 timestamps for flight lifecycle fields.
  scheduled_off?: string | null;
  scheduled_on?: string | null;
  estimated_off?: string | null;
  estimated_on?: string | null;
  actual_off?: string | null;
  actual_on?: string | null;
  departuretime?: number | null;
  arrivaltime?: number | null;
};

type AeroApiFlightResponse = {
  flights?: AeroApiFlightSummary[] | null;
};

type AeroApiSearchFlight = {
  fa_flight_id?: string | null;
  ident?: string | null;
  origin?: string | null;
  destination?: string | null;
  departuretime?: number | null;
  arrivaltime?: number | null;
};

type AeroApiSearchResponse = {
  flights?: AeroApiSearchFlight[] | null;
};

function buildSearchQueries(ident: string, epochStart: number, epochEnd: number) {
  // Try multiple query variants to maximize match likelihood.
  return [
    `-idents ${ident} -begin ${epochStart} -end ${epochEnd}`,
    `-ident ${ident} -begin ${epochStart} -end ${epochEnd}`,
    `-idents ${ident}`,
    `-ident ${ident}`
  ];
}

type AeroApiTrackPosition = {
  timestamp?: number | string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  ground_speed?: number | null;
  groundspeed?: number | null;
  groundspeed_kt?: number | null;
  groundspeed_kts?: number | null;
  groundspeed_knots?: number | null;
  ground_speed_kt?: number | null;
  heading?: number | null;
};

type AeroApiTrackResponse = {
  positions?: AeroApiTrackPosition[] | null;
};

class AdsbProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdsbProviderError";
    this.status = status;
  }
}

function normalizeTailNumber(tailNumber: string) {
  return tailNumber.trim().toUpperCase().replace(/\s+/g, "");
}

function resolveAirportLabel(value: AeroApiFlightSummary["origin"]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "Unknown";
  }
  if (!value || typeof value !== "object") {
    return "Unknown";
  }
  return value.code ?? value.icao ?? value.iata ?? "Unknown";
}

function parseIsoOrEpoch(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // AeroAPI epoch values are seconds
    return new Date(value * 1000);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveFlightTimes(flight: AeroApiFlightSummary) {
  const start =
    parseIsoOrEpoch(flight.actual_off) ??
    parseIsoOrEpoch(flight.estimated_off) ??
    parseIsoOrEpoch(flight.scheduled_off) ??
    parseIsoOrEpoch(flight.departuretime);
  const end =
    parseIsoOrEpoch(flight.actual_on) ??
    parseIsoOrEpoch(flight.estimated_on) ??
    parseIsoOrEpoch(flight.scheduled_on) ??
    parseIsoOrEpoch(flight.arrivaltime);
  return { start, end };
}

function computeMaxAltitude(track: FlightTrackPoint[]) {
  let maxAltitude: number | null = null;
  for (const point of track) {
    if (typeof point.altitudeFeet !== "number") {
      continue;
    }
    maxAltitude =
      maxAltitude === null ? point.altitudeFeet : Math.max(maxAltitude, point.altitudeFeet);
  }
  return maxAltitude;
}

function computeMaxGroundspeed(track: FlightTrackPoint[]) {
  let maxGroundspeed: number | null = null;
  for (const point of track) {
    if (typeof point.groundspeedKt !== "number") {
      continue;
    }
    maxGroundspeed =
      maxGroundspeed === null ? point.groundspeedKt : Math.max(maxGroundspeed, point.groundspeedKt);
  }
  return maxGroundspeed;
}

async function resolveAeroApiKey(): Promise<string | null> {
  const envKey = process.env.AEROAPI_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  const keyFile = process.env.AEROAPI_KEY_FILE?.trim();
  if (!keyFile) {
    return null;
  }

  const { readFile } = await import("fs/promises");
  try {
    const fileKey = (await readFile(keyFile, "utf8")).trim();
    return fileKey || null;
  } catch {
    return null;
  }
}

async function fetchAeroApi<T>(
  path: string,
  params: Record<string, string | number | null | undefined> = {}
): Promise<T> {
  const apiKey = await resolveAeroApiKey();
  if (!apiKey) {
    throw new AdsbProviderError("AeroAPI key is missing.");
  }

  const base = AEROAPI_API_BASE.endsWith("/") ? AEROAPI_API_BASE : `${AEROAPI_API_BASE}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        // AeroAPI v4+ authenticates via x-apikey only
        "x-apikey": apiKey
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error.";
    throw new AdsbProviderError(`AeroAPI request failed: ${message}`);
  }

  if (!response.ok) {
    throw new AdsbProviderError(
      `AeroAPI request failed with status ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

function buildTrackPoints(track: AeroApiTrackResponse | null): FlightTrackPoint[] {
  if (!track?.positions || !Array.isArray(track.positions)) {
    return [];
  }

  const rawPoints = track.positions
    .map((position) => {
      if (!position || typeof position !== "object") {
        return null;
      }
      const anyPosition = position as Record<string, unknown>;
      const timestamp = anyPosition.timestamp as unknown;
      const latitude = anyPosition.latitude as unknown;
      const longitude = anyPosition.longitude as unknown;
      const altitude = anyPosition.altitude as unknown;
      const heading = anyPosition.heading as unknown;
      const groundSpeed =
        (anyPosition.ground_speed as unknown) ??
        (anyPosition.ground_speed_kt as unknown) ??
        (anyPosition.groundspeed as unknown) ??
        (anyPosition.groundspeed_kt as unknown) ??
        (anyPosition.groundspeed_kts as unknown) ??
        (anyPosition.groundspeed_knots as unknown) ??
        null;
      const recordedAt = parseIsoOrEpoch(timestamp);
      if (
        !recordedAt ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return null;
      }

      const altitudeValue = parseNumeric(altitude);
      const groundSpeedValue = parseNumeric(groundSpeed);
      const headingValue = parseNumeric(heading);

      return {
        recordedAt,
        latitude,
        longitude,
        altitudeFeet: altitudeValue,
        groundspeedKt: groundSpeedValue,
        headingDeg: headingValue !== null ? Math.round(headingValue) : null
      } satisfies FlightTrackPoint;
    })
    .filter((point): point is FlightTrackPoint => point !== null);

  // AeroAPI altitude units can vary by endpoint/account. We normalize by detecting
  // "hundreds of feet" style values (e.g. 34 => 3,400 ft) based on max altitude.
  const maxRawAltitude = rawPoints.reduce<number>((max, point) => {
    const value = point.altitudeFeet;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return max;
    }
    return Math.max(max, value);
  }, 0);
  const altitudeScale = maxRawAltitude > 0 && maxRawAltitude <= 700 ? 100 : 1;

  if (altitudeScale === 1) {
    return rawPoints;
  }

  return rawPoints.map((point) => ({
    ...point,
    altitudeFeet:
      typeof point.altitudeFeet === "number"
        ? Math.round(point.altitudeFeet * altitudeScale)
        : null
  }));
}

export class AeroApiAdsbProvider implements AdsbProvider {
  async searchFlights(tailNumber: string, start: Date, end: Date): Promise<FlightCandidate[]> {
    const normalizedTailNumber = normalizeTailNumber(tailNumber);
    const epochStart = Math.floor(start.getTime() / 1000);
    const epochEnd = Math.floor(end.getTime() / 1000);
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

    try {
      // 1) Primary: historical flights by registration (AeroAPI-recommended for past dates)
      let flights: AeroApiFlightSummary[] = [];
      try {
        const historyResponse = await fetchAeroApi<AeroApiFlightResponse>(
          `/history/flights/${encodeURIComponent(normalizedTailNumber)}`,
          {
            ident_type: "registration",
            start: isoStart,
            end: isoEnd,
            max_pages: 5
          }
        );
        flights = historyResponse.flights ?? [];
      } catch (error) {
        if (!(error instanceof AdsbProviderError && error.status === 404)) {
          throw error;
        }
      }

      // 2) Secondary: live flights by ident if history empty
      if (flights.length === 0) {
        try {
          const flightsResponse = await fetchAeroApi<AeroApiFlightResponse>(
            `/flights/${encodeURIComponent(normalizedTailNumber)}`,
            {
              start: isoStart,
              end: isoEnd,
              max_pages: 5
            }
          );
          flights = flightsResponse.flights ?? [];
        } catch (error) {
          if (!(error instanceof AdsbProviderError && error.status === 404)) {
            throw error;
          }
        }
      }

      // 3) Fallback: /search/flights with ident filter if nothing yet
      if (flights.length === 0) {
        try {
          const queries = buildSearchQueries(normalizedTailNumber, epochStart, epochEnd);
          for (const query of queries) {
            const searchResponse = await fetchAeroApi<AeroApiSearchResponse>("/flights/search", {
              query,
              max_pages: 5
            });
            const searchFlights = searchResponse.flights ?? [];
            if (searchFlights.length > 0) {
              flights = searchFlights.map((flight) => ({
                fa_flight_id: flight.fa_flight_id,
                ident: flight.ident,
                origin: flight.origin ? { code: flight.origin } : undefined,
                destination: flight.destination ? { code: flight.destination } : undefined,
                departuretime: flight.departuretime,
                arrivaltime: flight.arrivaltime
              }));
              break;
            }
          }
        } catch (error) {
          if (!(error instanceof AdsbProviderError && error.status === 404)) {
            throw error;
          }
        }
      }

      const candidates = await Promise.all(
        flights.map(async (flight) => {
          const faFlightId = flight.fa_flight_id ?? null;
          if (!faFlightId) {
            return null;
          }

          const resolvedTimes = resolveFlightTimes(flight);

          const trackResponse =
            (await fetchAeroApi<AeroApiTrackResponse>(
              `/history/flights/${encodeURIComponent(faFlightId)}/track`,
              { include_estimated_positions: true }
            ).catch(() => null)) ??
            (await fetchAeroApi<AeroApiTrackResponse>(
              `/flights/${encodeURIComponent(faFlightId)}/track`,
              { include_estimated_positions: true }
            ).catch(() => null));

          const trackPoints = buildTrackPoints(trackResponse);
          // If AeroAPI didn't provide usable times, infer from track when possible.
          const inferredStart =
            resolvedTimes.start ?? (trackPoints[0]?.recordedAt ?? null);
          const inferredEnd =
            resolvedTimes.end ?? (trackPoints[trackPoints.length - 1]?.recordedAt ?? null);
          if (!inferredStart || !inferredEnd) {
            return null;
          }

          const durationMinutes = computeDurationMinutes(inferredStart, inferredEnd, trackPoints);
          const distanceNm = computeDistanceNm(trackPoints);

          return {
            providerFlightId: `${AEROAPI_PROVIDER_NAME}-${faFlightId}`,
            tailNumber: normalizedTailNumber,
            startTime: inferredStart,
            endTime: inferredEnd,
            durationMinutes,
            distanceNm,
            depLabel: resolveAirportLabel(flight.origin),
            arrLabel: resolveAirportLabel(flight.destination),
            stats: {
              maxAltitudeFeet: computeMaxAltitude(trackPoints) ?? null,
              maxGroundspeedKt: computeMaxGroundspeed(trackPoints) ?? null
            },
            track: trackPoints
          } satisfies FlightCandidate;
        })
      );

      return candidates.filter((candidate): candidate is FlightCandidate => candidate !== null);
    } catch (error) {
      if (error instanceof AdsbProviderError && error.status && error.status >= 500) {
        // Treat upstream 5xx as "no results" instead of crashing the app.
        return [];
      }
      throw error;
    }
  }
}

export const aeroApiProviderName = AEROAPI_PROVIDER_NAME;
