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
  // preferred sources of total time
  hobbsOut?: unknown;
  hobbsIn?: unknown;
  timeOut?: unknown; // "HH:MM"
  timeIn?: unknown; // "HH:MM"

  // time buckets (hours)
  picTime?: unknown;
  sicTime?: unknown;
  dualReceivedTime?: unknown;
  soloTime?: unknown;
  groundTime?: unknown;
  simulatorTime?: unknown;
};

export function computeTotalTimeHours(input: LogbookTotalsInput): number | null {
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

  const parts = [
    toNumber(input.picTime) ?? 0,
    toNumber(input.sicTime) ?? 0,
    toNumber(input.dualReceivedTime) ?? 0,
    toNumber(input.soloTime) ?? 0,
    toNumber(input.groundTime) ?? 0,
    toNumber(input.simulatorTime) ?? 0
  ];
  const sum = parts.reduce((acc, v) => acc + v, 0);
  if (sum > 0) {
    return Math.round(sum * 100) / 100;
  }
  return null;
}

