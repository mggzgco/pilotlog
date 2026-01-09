import type { FlightTrackPoint } from "@/app/lib/adsb/types";

const EARTH_RADIUS_NM = 3440.065;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineNm(
  start: FlightTrackPoint,
  end: FlightTrackPoint
): number {
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(end.longitude - start.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}

export function computeDistanceNm(track: FlightTrackPoint[]): number | null {
  if (track.length < 2) {
    return null;
  }

  let total = 0;
  for (let index = 1; index < track.length; index += 1) {
    total += haversineNm(track[index - 1], track[index]);
  }

  return total;
}

export function computeDurationMinutes(
  startTime: Date | null,
  endTime: Date | null,
  track: FlightTrackPoint[]
): number | null {
  let start = startTime ?? null;
  let end = endTime ?? null;

  if (!start || !end) {
    if (track.length >= 2) {
      start = track[0].recordedAt;
      end = track[track.length - 1].recordedAt;
    }
  }

  if (!start || !end) {
    return null;
  }

  const minutes = (end.getTime() - start.getTime()) / 60000;
  return minutes > 0 ? minutes : null;
}
