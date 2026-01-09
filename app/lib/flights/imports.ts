export type ImportCandidate = {
  providerFlightId: string;
  tailNumber: string;
  startTime: Date;
  endTime: Date;
  durationMinutes?: number | null;
  distanceNm?: number | null;
  depLabel: string;
  arrLabel: string;
  stats?: {
    maxAltitudeFeet?: number | null;
    maxGroundspeedKt?: number | null;
  } | null;
  track: Array<{
    recordedAt: Date;
    latitude: number;
    longitude: number;
    altitudeFeet?: number | null;
    groundspeedKt?: number | null;
    headingDeg?: number | null;
  }>;
};

export function dedupeImportCandidates(candidates: ImportCandidate[]) {
  const seen = new Set<string>();
  const deduped: ImportCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.providerFlightId.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}
