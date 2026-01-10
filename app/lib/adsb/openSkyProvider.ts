import type { AdsbProvider } from "@/app/lib/adsb/provider";
import type { FlightCandidate, FlightTrackPoint } from "@/app/lib/adsb/types";
import { computeDistanceNm, computeDurationMinutes } from "@/app/lib/flights/compute";

const OPENSKY_PROVIDER_NAME = "opensky";
const OPENSKY_API_BASE =
  process.env.OPENSKY_API_BASE ?? "https://opensky-network.org/api";

type OpenSkyAircraft = {
  icao24?: string | null;
  reg?: string | null;
  registration?: string | null;
};

type OpenSkyFlight = {
  firstSeen?: number | null;
  lastSeen?: number | null;
  estDepartureAirport?: string | null;
  estArrivalAirport?: string | null;
};

type OpenSkyTrack = {
  path?: Array<
    [number, number, number, number | null, number | null, boolean | null]
  >;
};

function metersToFeet(value: number) {
  return value * 3.28084;
}

function normalizeTailNumber(tailNumber: string) {
  return tailNumber.trim().toUpperCase().replace(/\s+/g, "");
}

function compactTailNumber(tailNumber: string) {
  return normalizeTailNumber(tailNumber).replace(/-/g, "");
}

function buildAuthHeader(): string | null {
  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;
  if (!username || !password) {
    return null;
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function fetchOpenSky<T>(
  path: string,
  params: Record<string, string | number | null | undefined> = {}
): Promise<T | null> {
  const url = new URL(path, OPENSKY_API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const headers: HeadersInit = {};
  const authHeader = buildAuthHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildTrackPoints(track: OpenSkyTrack | null): FlightTrackPoint[] {
  if (!track?.path || !Array.isArray(track.path)) {
    return [];
  }

  return track.path
    .map((point) => {
      if (!Array.isArray(point) || point.length < 3) {
        return null;
      }
      const [timestamp, latitude, longitude, altitudeMeters, headingDeg] = point;
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
        altitudeFeet:
          typeof altitudeMeters === "number" ? metersToFeet(altitudeMeters) : null,
        headingDeg: typeof headingDeg === "number" ? headingDeg : null
      } satisfies FlightTrackPoint;
    })
    .filter((point): point is FlightTrackPoint => point !== null);
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

async function resolveIcao24(tailNumber: string): Promise<string | null> {
  const normalized = normalizeTailNumber(tailNumber);
  const normalizedCompact = compactTailNumber(tailNumber);
  let aircraft = await fetchOpenSky<OpenSkyAircraft[]>(
    "/metadata/aircraft/list",
    { reg: normalized }
  );
  if ((!aircraft || aircraft.length === 0) && normalizedCompact !== normalized) {
    aircraft = await fetchOpenSky<OpenSkyAircraft[]>("/metadata/aircraft/list", {
      reg: normalizedCompact
    });
  }
  if (!aircraft || aircraft.length === 0) {
    return null;
  }

  const match = aircraft.find(
    (entry) =>
      compactTailNumber(entry.reg ?? entry.registration ?? "") === normalizedCompact &&
      entry.icao24
  );
  return match?.icao24 ?? aircraft[0]?.icao24 ?? null;
}

export class OpenSkyAdsbProvider implements AdsbProvider {
  async searchFlights(tailNumber: string, start: Date, end: Date): Promise<FlightCandidate[]> {
    const icao24 = await resolveIcao24(tailNumber);
    if (!icao24) {
      return [];
    }

    const flights = await fetchOpenSky<OpenSkyFlight[]>(
      "/flights/aircraft",
      {
        icao24,
        begin: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000)
      }
    );
    if (!flights || flights.length === 0) {
      return [];
    }

    const candidates = await Promise.all(
      flights.map(async (flight, index) => {
        const firstSeen = flight.firstSeen ?? null;
        const lastSeen = flight.lastSeen ?? null;
        if (!firstSeen || !lastSeen) {
          return null;
        }

        const track = await fetchOpenSky<OpenSkyTrack>(
          "/tracks/all",
          { icao24, time: firstSeen }
        );
        const trackPoints = buildTrackPoints(track);
        const startTime = new Date(firstSeen * 1000);
        const endTime = new Date(lastSeen * 1000);
        const durationMinutes = computeDurationMinutes(startTime, endTime, trackPoints);
        const distanceNm = computeDistanceNm(trackPoints);
        const maxAltitude = computeMaxAltitude(trackPoints);

        return {
          providerFlightId: `${OPENSKY_PROVIDER_NAME}-${icao24}-${firstSeen}-${index}`,
          tailNumber: normalizeTailNumber(tailNumber),
          startTime,
          endTime,
          durationMinutes,
          distanceNm,
          depLabel: flight.estDepartureAirport ?? "Unknown",
          arrLabel: flight.estArrivalAirport ?? "Unknown",
          stats: {
            maxAltitudeFeet: maxAltitude ?? null,
            maxGroundspeedKt: null
          },
          track: trackPoints
        } satisfies FlightCandidate;
      })
    );

    return candidates.filter((candidate): candidate is FlightCandidate => candidate !== null);
  }
}

export const openSkyProviderName = OPENSKY_PROVIDER_NAME;
