import { describe, expect, it } from "vitest";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";

const baseCandidate = {
  tailNumber: "N12345",
  startTime: new Date("2024-01-01T10:00:00Z"),
  endTime: new Date("2024-01-01T11:00:00Z"),
  durationMinutes: 60,
  distanceNm: 120,
  depLabel: "KSEA",
  arrLabel: "KPDX",
  stats: null,
  track: [
    {
      recordedAt: new Date("2024-01-01T10:00:00Z"),
      latitude: 47.0,
      longitude: -122.0
    },
    {
      recordedAt: new Date("2024-01-01T11:00:00Z"),
      latitude: 45.6,
      longitude: -122.6
    }
  ]
};

describe("import candidate de-duplication", () => {
  it("removes duplicate provider flight ids", () => {
    const candidates = [
      { ...baseCandidate, providerFlightId: "FLIGHT-1" },
      { ...baseCandidate, providerFlightId: "FLIGHT-1" },
      { ...baseCandidate, providerFlightId: "FLIGHT-2" }
    ];

    const deduped = dedupeImportCandidates(candidates);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((candidate) => candidate.providerFlightId)).toEqual([
      "FLIGHT-1",
      "FLIGHT-2"
    ]);
  });

  it("ignores empty provider flight ids", () => {
    const candidates = [
      { ...baseCandidate, providerFlightId: "" },
      { ...baseCandidate, providerFlightId: "FLIGHT-3" }
    ];

    const deduped = dedupeImportCandidates(candidates);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.providerFlightId).toBe("FLIGHT-3");
  });
});
