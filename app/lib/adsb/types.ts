export interface FlightTrackPoint {
  recordedAt: Date;
  latitude: number;
  longitude: number;
  altitudeFeet?: number | null;
  groundspeedKt?: number | null;
  headingDeg?: number | null;
}

export interface FlightStats {
  maxAltitudeFeet?: number | null;
  maxGroundspeedKt?: number | null;
}

export interface FlightCandidate {
  providerFlightId: string;
  tailNumber: string;
  startTime: Date;
  endTime: Date;
  durationMinutes?: number | null;
  distanceNm?: number | null;
  depLabel: string;
  arrLabel: string;
  stats?: FlightStats | null;
  track: FlightTrackPoint[];
}
