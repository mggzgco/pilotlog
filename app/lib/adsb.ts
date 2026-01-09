import { prisma } from "@/app/lib/db";

export interface AdsbFlight {
  tailNumber: string;
  origin: string;
  destination: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  distanceNm: number;
  routePolyline: string;
}

// IMPORT-002: provider interface for ADS-B data sources
export interface AdsbProvider {
  searchFlights(tailNumber: string, start: Date, end: Date): Promise<AdsbFlight[]>;
}

export class MockAdsbProvider implements AdsbProvider {
  async searchFlights(tailNumber: string, start: Date, end: Date): Promise<AdsbFlight[]> {
    // IMPORT-003: mock provider returns sample flights for demo tail
    if (tailNumber !== "N12345") {
      return [];
    }

    return [
      {
        tailNumber,
        origin: "KPAE",
        destination: "KSEA",
        startTime: new Date(start.getTime() + 45 * 60 * 1000),
        endTime: new Date(start.getTime() + 85 * 60 * 1000),
        durationMinutes: 40,
        distanceNm: 26,
        routePolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
      },
      {
        tailNumber,
        origin: "KSEA",
        destination: "KBFI",
        startTime: new Date(start.getTime() + 4 * 60 * 60 * 1000),
        endTime: new Date(start.getTime() + 4 * 60 * 60 * 1000 + 38 * 60 * 1000),
        durationMinutes: 38,
        distanceNm: 18,
        routePolyline: "y`kiF~hkbVx}@y|Bq}@o}@e}@c}@"
      }
    ];
  }
}

export function getAdsbProvider(): AdsbProvider {
  return new MockAdsbProvider();
}

export async function importAdsbFlights(
  userId: string,
  tailNumber: string,
  start: Date,
  end: Date
) {
  const provider = getAdsbProvider();
  const flights = await provider.searchFlights(tailNumber, start, end);

  // IMPORT-004: persist imported flights into pilot records
  if (flights.length === 0) {
    // IMPORT-005: nothing to import for this tail + window
    return [];
  }

  // IMPORT-006: batch create imported flights
  const created = await prisma.$transaction(
    flights.map((flight) =>
      prisma.flight.create({
        data: {
          userId,
          tailNumber: flight.tailNumber,
          origin: flight.origin,
          destination: flight.destination,
          startTime: flight.startTime,
          endTime: flight.endTime,
          durationMinutes: flight.durationMinutes,
          distanceNm: flight.distanceNm,
          routePolyline: flight.routePolyline
        }
      })
    )
  );

  return created;
}
