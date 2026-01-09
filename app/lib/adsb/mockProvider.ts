import type { AdsbProvider } from "@/app/lib/adsb/provider";
import type { FlightCandidate } from "@/app/lib/adsb/types";

const MOCK_PROVIDER_NAME = "mock";

function buildTrackPoints(
  startTime: Date,
  coordinates: Array<[number, number]>,
  altitudeFeet: number,
  groundspeedKt: number
) {
  const stepMs = 5 * 60 * 1000;
  return coordinates.map(([latitude, longitude], index) => ({
    recordedAt: new Date(startTime.getTime() + index * stepMs),
    latitude,
    longitude,
    altitudeFeet,
    groundspeedKt
  }));
}

export class MockAdsbProvider implements AdsbProvider {
  async searchFlights(tailNumber: string, start: Date, end: Date): Promise<FlightCandidate[]> {
    if (tailNumber !== "N12345") {
      return [];
    }

    const firstStart = new Date(start.getTime() + 45 * 60 * 1000);
    const firstTrack = buildTrackPoints(
      firstStart,
      [
        [47.906, -122.281],
        [47.787, -122.246],
        [47.678, -122.258],
        [47.551, -122.302],
        [47.449, -122.309]
      ],
      5500,
      120
    );

    const secondStart = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const secondTrack = buildTrackPoints(
      secondStart,
      [
        [47.449, -122.309],
        [47.538, -122.293],
        [47.612, -122.325],
        [47.643, -122.362],
        [47.536, -122.304]
      ],
      3200,
      110
    );

    const thirdStart = new Date(start.getTime() + 7 * 60 * 60 * 1000);
    const thirdTrack = buildTrackPoints(
      thirdStart,
      [
        [47.536, -122.304],
        [47.515, -122.337],
        [47.494, -122.39],
        [47.469, -122.454],
        [47.443, -122.485]
      ],
      4200,
      115
    );

    return [
      {
        providerFlightId: `${MOCK_PROVIDER_NAME}-flight-001`,
        tailNumber,
        startTime: firstStart,
        endTime: new Date(firstStart.getTime() + 40 * 60 * 1000),
        durationMinutes: 40,
        distanceNm: 26,
        depLabel: "KPAE",
        arrLabel: "KSEA",
        stats: { maxAltitudeFeet: 5500, maxGroundspeedKt: 120 },
        track: firstTrack
      },
      {
        providerFlightId: `${MOCK_PROVIDER_NAME}-flight-002`,
        tailNumber,
        startTime: secondStart,
        endTime: new Date(secondStart.getTime() + 38 * 60 * 1000),
        durationMinutes: 38,
        distanceNm: 18,
        depLabel: "KSEA",
        arrLabel: "KBFI",
        stats: { maxAltitudeFeet: 3200, maxGroundspeedKt: 110 },
        track: secondTrack
      },
      {
        providerFlightId: `${MOCK_PROVIDER_NAME}-flight-003`,
        tailNumber,
        startTime: thirdStart,
        endTime: new Date(thirdStart.getTime() + 42 * 60 * 1000),
        durationMinutes: 42,
        distanceNm: 22,
        depLabel: "KBFI",
        arrLabel: "KRNT",
        stats: { maxAltitudeFeet: 4200, maxGroundspeedKt: 115 },
        track: thirdTrack
      }
    ].filter((flight) => flight.startTime <= end);
  }
}

export const mockProviderName = MOCK_PROVIDER_NAME;
