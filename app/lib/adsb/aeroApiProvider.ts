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

  const envKey =
    process.env.AEROAPI_KEY?.trim() ||
    process.env.AEROAPI_API_KEY?.trim() ||
    process.env.FLIGHTAWARE_API_KEY?.trim();
  if (envKey) {
    cachedAeroApiKey = envKey;
    return envKey;
  }

  const keyFile = process.env.AEROAPI_KEY_FILE?.trim();
  if (!keyFile) {
    return null;
  }

  const { readFile } = await import("fs/promises");
  try {
    const fileKey = (await readFile(keyFile, "utf8")).trim();
    cachedAeroApiKey = fileKey || null;
  } catch {
    return null;
  }

  return cachedAeroApiKey ?? null;
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
    const flightsResponse = await fetchAeroApi<AeroApiFlightResponse>(
      `/flights/${encodeURIComponent(normalizedTailNumber)}`,
      {
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000)
      }
    );

    const flights = flightsResponse.flights ?? [];
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

        const trackResponse = await fetchAeroApi<AeroApiTrackResponse>(
          `/flight/${encodeURIComponent(faFlightId)}/track`
        ).catch(() => null);

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
