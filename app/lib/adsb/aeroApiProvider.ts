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
  timestamp?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  ground_speed?: number | null;
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

let cachedAeroApiKey: string | null | undefined;

async function resolveAeroApiKey(): Promise<string | null> {
  if (cachedAeroApiKey !== undefined) {
    return cachedAeroApiKey;
  }

  const envKey = process.env.AEROAPI_KEY?.trim();
  if (envKey) {
    cachedAeroApiKey = envKey;
    return envKey;
  }

  const keyFile = process.env.AEROAPI_KEY_FILE?.trim();
  if (!keyFile) {
    cachedAeroApiKey = null;
    return null;
  }

  const { readFile } = await import("fs/promises");
  try {
    const fileKey = (await readFile(keyFile, "utf8")).trim();
    cachedAeroApiKey = fileKey || null;
  } catch {
    cachedAeroApiKey = null;
  }

  return cachedAeroApiKey;
}

async function fetchAeroApi<T>(
  path: string,
  params: Record<string, string | number | null | undefined> = {}
): Promise<T> {
  const apiKey = await resolveAeroApiKey();
  if (!apiKey) {
    throw new AdsbProviderError("AeroAPI key is missing.");
  }

  const url = new URL(path, AEROAPI_API_BASE);
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
        // FlightAware AeroAPI accepts either x-apikey or Authorization: Bearer
        "x-apikey": apiKey,
        Authorization: `Bearer ${apiKey}`
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

  return track.positions
    .map((position) => {
      if (!position || typeof position !== "object") {
        return null;
      }
      const { timestamp, latitude, longitude, altitude, ground_speed, heading } = position;
      if (
        typeof timestamp !== "number" ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return null;
      }

      return {
        recordedAt: new Date(timestamp * 1000),
        latitude,
        longitude,
        altitudeFeet: typeof altitude === "number" ? altitude : null,
        groundspeedKt: typeof ground_speed === "number" ? ground_speed : null,
        headingDeg: typeof heading === "number" ? heading : null
      } satisfies FlightTrackPoint;
    })
    .filter((point): point is FlightTrackPoint => point !== null);
}

export class AeroApiAdsbProvider implements AdsbProvider {
  async searchFlights(tailNumber: string, start: Date, end: Date): Promise<FlightCandidate[]> {
    const normalizedTailNumber = normalizeTailNumber(tailNumber);
    const epochStart = Math.floor(start.getTime() / 1000);
    const epochEnd = Math.floor(end.getTime() / 1000);
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

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
            start: epochStart,
            end: epochEnd,
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
          const searchResponse = await fetchAeroApi<AeroApiSearchResponse>("/search/flights", {
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
        const departureEpoch = flight.departuretime ?? null;
        const arrivalEpoch = flight.arrivaltime ?? null;

        if (!faFlightId || !departureEpoch || !arrivalEpoch) {
          return null;
        }

        const startTime = new Date(departureEpoch * 1000);
        const endTime = new Date(arrivalEpoch * 1000);
        if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
          return null;
        }

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
        const durationMinutes = computeDurationMinutes(startTime, endTime, trackPoints);
        const distanceNm = computeDistanceNm(trackPoints);

        return {
          providerFlightId: `${AEROAPI_PROVIDER_NAME}-${faFlightId}`,
          tailNumber: normalizedTailNumber,
          startTime,
          endTime,
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
  }
}

export const aeroApiProviderName = AEROAPI_PROVIDER_NAME;
