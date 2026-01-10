function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseTimeHHMM(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

export type LogbookTotalsInput = {
  // possible sources of total time
  hobbsOut?: unknown;
  hobbsIn?: unknown;
  timeOut?: unknown; // "HH:MM"
  timeIn?: unknown; // "HH:MM"

  // time buckets (hours)
  picTime?: unknown;
  sicTime?: unknown;
  dualReceivedTime?: unknown;
  soloTime?: unknown;
  nightTime?: unknown;
  xcTime?: unknown;
  simulatedInstrumentTime?: unknown;
  instrumentTime?: unknown;
  groundTime?: unknown;
  simulatorTime?: unknown;
};

export function computeTotalTimeHours(input: LogbookTotalsInput): number | null {
  // Heuristic:
  // - If the pilot entered explicit "airborne/training" buckets (PIC/SIC/Dual/Solo),
  //   treat those as the authoritative total. This keeps total consistent with
  //   how many pilots log training time (e.g., dual=0.9 => total=0.9), even if
  //   block/Hobbs would be higher due to taxi.
  // - Otherwise, fall back to Hobbs or Time Out/In.
  // - If those aren't available, fall back to other flight-time buckets.
  // - Ground and Simulator are tracked independently and do NOT contribute to total.

  const primaryBuckets = [
    toNumber(input.picTime),
    toNumber(input.sicTime),
    toNumber(input.dualReceivedTime),
    toNumber(input.soloTime)
  ];
  const hasPrimary = primaryBuckets.some((v) => v !== null && v !== undefined);
  const primarySum = primaryBuckets.reduce((acc, v) => acc + (v ?? 0), 0);
  if (hasPrimary && primarySum > 0) {
    return Math.round(primarySum * 100) / 100;
  }

  const hobbsOut = toNumber(input.hobbsOut);
  const hobbsIn = toNumber(input.hobbsIn);
  if (hobbsOut !== null && hobbsIn !== null && hobbsIn >= hobbsOut) {
    const diff = hobbsIn - hobbsOut;
    if (diff > 0) {
      return Math.round(diff * 100) / 100;
    }
  }

  const timeOut = parseTimeHHMM(input.timeOut);
  const timeIn = parseTimeHHMM(input.timeIn);
  if (timeOut && timeIn) {
    const outMinutes = timeOut.hours * 60 + timeOut.minutes;
    let inMinutes = timeIn.hours * 60 + timeIn.minutes;
    if (inMinutes < outMinutes) {
      inMinutes += 24 * 60;
    }
    const diffMinutes = inMinutes - outMinutes;
    if (diffMinutes > 0) {
      return Math.round((diffMinutes / 60) * 100) / 100;
    }
  }

  const fallbackBuckets = [
    toNumber(input.xcTime),
    toNumber(input.nightTime),
    toNumber(input.simulatedInstrumentTime),
    toNumber(input.instrumentTime)
  ];
  const hasFallback = fallbackBuckets.some((v) => v !== null && v !== undefined);
  const fallbackSum = fallbackBuckets.reduce((acc, v) => acc + (v ?? 0), 0);
  if (hasFallback && fallbackSum > 0) {
    return Math.round(fallbackSum * 100) / 100;
  }

  return null;
}

