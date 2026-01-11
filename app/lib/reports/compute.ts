import type { CostItem, Flight, LogbookEntry } from "@prisma/client";
import { flightHasLandingOverDistanceNm } from "@/app/lib/airports/xc";

type LogbookEntryWithFlight = LogbookEntry & {
  flight?:
    | (Pick<Flight, "durationMinutes"> & {
        originAirport?: { latitude: number | null; longitude: number | null } | null;
        destinationAirport?: { latitude: number | null; longitude: number | null } | null;
        stops?: Array<{ airport?: { latitude: number | null; longitude: number | null } | null }>;
      })
    | null;
};

type FlightWithDetails = Flight & {
  logbookEntries: LogbookEntry[];
  costItems: CostItem[];
  originAirport?: { latitude: number | null; longitude: number | null } | null;
  destinationAirport?: { latitude: number | null; longitude: number | null } | null;
  stops?: Array<{ airport?: { latitude: number | null; longitude: number | null } | null }>;
};

export type ReportSummary = {
  totalTime: number;
  picTime: number;
  dualReceivedTime: number;
  nightTime: number;
  xcTime: number;
  simulatedInstrumentTime: number;
  actualInstrumentTime: number;
  simulatorTime: number;
  groundTime: number;
  dayTakeoffs: number;
  dayLandings: number;
  nightTakeoffs: number;
  nightLandings: number;
  costTotalCents: number;
  costByCategory: Record<string, number>;
};

export type ReportFlightRow = {
  id: string;
  date: Date;
  tailNumber: string;
  origin: string;
  destination: string | null;
  totalTime: number;
  picTime: number;
  dualReceivedTime: number;
  nightTime: number;
  xcTime: number;
  distanceNm: number | null;
  costTotalCents: number;
  costByCategory: Record<string, number>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function totalTimeForEntry(entry: LogbookEntryWithFlight) {
  const rawTotal = toNumber(entry.totalTime);
  if (rawTotal > 0) {
    return rawTotal;
  }
  const durationMinutes = entry.flight?.durationMinutes;
  if (!durationMinutes) {
    return 0;
  }
  return durationMinutes / 60;
}

function xcTimeForEntry(entry: LogbookEntryWithFlight, totalTime: number) {
  if (!entry.flight) return 0;
  return flightHasLandingOverDistanceNm(entry.flight, 50) ? totalTime : 0;
}

export function computeReportSummary(
  logbookEntries: LogbookEntryWithFlight[],
  costItems: CostItem[]
): ReportSummary {
  const summary: ReportSummary = {
    totalTime: 0,
    picTime: 0,
    dualReceivedTime: 0,
    nightTime: 0,
    xcTime: 0,
    simulatedInstrumentTime: 0,
    actualInstrumentTime: 0,
    simulatorTime: 0,
    groundTime: 0,
    dayTakeoffs: 0,
    dayLandings: 0,
    nightTakeoffs: 0,
    nightLandings: 0,
    costTotalCents: 0,
    costByCategory: {}
  };

  for (const entry of logbookEntries) {
    const totalTime = totalTimeForEntry(entry);
    summary.totalTime += totalTime;
    summary.picTime += toNumber(entry.picTime);
    // prefer dedicated dualReceivedTime; fall back to legacy sicTime (previously used as "dual received" in UI)
    summary.dualReceivedTime += toNumber((entry as any).dualReceivedTime ?? entry.sicTime);
    summary.nightTime += toNumber(entry.nightTime);
    const explicitXc = toNumber((entry as any).xcTime);
    summary.xcTime += explicitXc > 0 ? explicitXc : xcTimeForEntry(entry, totalTime);
    summary.simulatedInstrumentTime += toNumber((entry as any).simulatedInstrumentTime);
    summary.actualInstrumentTime += toNumber(entry.instrumentTime);
    summary.simulatorTime += toNumber((entry as any).simulatorTime);
    summary.groundTime += toNumber((entry as any).groundTime);
    summary.dayTakeoffs += toNumber((entry as any).dayTakeoffs);
    summary.dayLandings += toNumber((entry as any).dayLandings);
    summary.nightTakeoffs += toNumber((entry as any).nightTakeoffs);
    summary.nightLandings += toNumber((entry as any).nightLandings);
  }

  for (const item of costItems) {
    summary.costTotalCents += item.amountCents;
    summary.costByCategory[item.category] =
      (summary.costByCategory[item.category] ?? 0) + item.amountCents;
  }

  return summary;
}

export function computeReportFlightRows(
  flights: FlightWithDetails[],
  categories: string[]
): ReportFlightRow[] {
  return flights.map((flight) => {
    const logbookEntries = flight.logbookEntries;
    const totals = logbookEntries.reduce(
      (acc, entry) => {
        const totalTime = toNumber(entry.totalTime);
        acc.totalTime += totalTime;
        acc.picTime += toNumber(entry.picTime);
        acc.dualReceivedTime += toNumber((entry as any).dualReceivedTime ?? entry.sicTime);
        acc.nightTime += toNumber(entry.nightTime);
        acc.explicitXcTime += toNumber((entry as any).xcTime);
        return acc;
      },
      { totalTime: 0, picTime: 0, dualReceivedTime: 0, nightTime: 0, explicitXcTime: 0 }
    );

    if (totals.totalTime === 0 && flight.durationMinutes) {
      totals.totalTime = flight.durationMinutes / 60;
    }

    const xcTime =
      totals.explicitXcTime > 0
        ? totals.explicitXcTime
        : flightHasLandingOverDistanceNm(flight, 50)
          ? totals.totalTime
          : 0;

    const costByCategory: Record<string, number> = {};
    let costTotalCents = 0;
    for (const item of flight.costItems) {
      costTotalCents += item.amountCents;
      costByCategory[item.category] =
        (costByCategory[item.category] ?? 0) + item.amountCents;
    }

    for (const category of categories) {
      if (!costByCategory[category]) {
        costByCategory[category] = 0;
      }
    }

    return {
      id: flight.id,
      date: flight.startTime,
      tailNumber: flight.tailNumber,
      origin: flight.origin,
      destination: flight.destination,
      totalTime: totals.totalTime,
      picTime: totals.picTime,
      dualReceivedTime: totals.dualReceivedTime,
      nightTime: totals.nightTime,
      xcTime,
      distanceNm: flight.distanceNm,
      costTotalCents,
      costByCategory
    };
  });
}
