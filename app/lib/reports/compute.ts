import type { CostItem, Flight, LogbookEntry } from "@prisma/client";

type LogbookEntryWithFlight = LogbookEntry & {
  flight?: Pick<Flight, "durationMinutes" | "distanceNm"> | null;
};

type FlightWithDetails = Flight & {
  logbookEntries: LogbookEntry[];
  costItems: CostItem[];
};

export type ReportSummary = {
  totalTime: number;
  picTime: number;
  dualReceivedTime: number;
  nightTime: number;
  xcTime: number;
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
  const distanceNm = entry.flight?.distanceNm ?? null;
  if (distanceNm !== null && distanceNm >= 50) {
    return totalTime;
  }
  return 0;
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
    costTotalCents: 0,
    costByCategory: {}
  };

  for (const entry of logbookEntries) {
    const totalTime = totalTimeForEntry(entry);
    summary.totalTime += totalTime;
    summary.picTime += toNumber(entry.picTime);
    summary.dualReceivedTime += toNumber(entry.sicTime);
    summary.nightTime += toNumber(entry.nightTime);
    summary.xcTime += xcTimeForEntry(entry, totalTime);
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
        acc.dualReceivedTime += toNumber(entry.sicTime);
        acc.nightTime += toNumber(entry.nightTime);
        return acc;
      },
      { totalTime: 0, picTime: 0, dualReceivedTime: 0, nightTime: 0 }
    );

    if (totals.totalTime === 0 && flight.durationMinutes) {
      totals.totalTime = flight.durationMinutes / 60;
    }

    const xcTime =
      flight.distanceNm !== null && flight.distanceNm >= 50
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
