type AirportCoords = {
  latitude: number | null;
  longitude: number | null;
};

const EARTH_RADIUS_NM = 3440.065;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

export function greatCircleDistanceNm(a: AirportCoords, b: AirportCoords): number | null {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  ) {
    return null;
  }
  const lat1 = toRadians(a.latitude);
  const lon1 = toRadians(a.longitude);
  const lat2 = toRadians(b.latitude);
  const lon2 = toRadians(b.longitude);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_NM * c;
}

export function flightHasLandingOverDistanceNm(
  flight: {
    originAirport?: AirportCoords | null;
    destinationAirport?: AirportCoords | null;
    stops?: Array<{ airport?: AirportCoords | null }>;
  },
  thresholdNm: number
): boolean {
  const origin = flight.originAirport ?? null;
  if (!origin) return false;

  const landingAirports: AirportCoords[] = [];
  if (flight.stops && flight.stops.length > 0) {
    for (const stop of flight.stops) {
      if (stop.airport) landingAirports.push(stop.airport);
    }
  }
  if (flight.destinationAirport) landingAirports.push(flight.destinationAirport);

  // FAR-style proxy: any landing point >= threshold from departure qualifies.
  let maxDistance = 0;
  for (const landing of landingAirports) {
    const nm = greatCircleDistanceNm(origin, landing);
    if (nm !== null && nm > maxDistance) {
      maxDistance = nm;
    }
  }
  return maxDistance >= thresholdNm;
}

