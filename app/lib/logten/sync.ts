import crypto from "crypto";
import { LogTenMapping } from "@/app/lib/logten/mapping";

export type LogTenRowNormalized = {
  date: string; // YYYY-MM-DD (as provided)
  tailNumberSnapshot: string;
  origin: string;
  destination: string;
  timeOut: string | null; // HH:MM
  timeIn: string | null; // HH:MM
  hobbsOut: number | null;
  hobbsIn: number | null;
  picTime: number | null;
  sicTime: number | null;
  dualReceivedTime: number | null;
  soloTime: number | null;
  nightTime: number | null;
  xcTime: number | null;
  simulatedInstrumentTime: number | null;
  instrumentTime: number | null;
  simulatorTime: number | null;
  groundTime: number | null;
  dayTakeoffs: number | null;
  dayLandings: number | null;
  nightTakeoffs: number | null;
  nightLandings: number | null;
  remarks: string | null;
  externalId: string | null;
  externalUpdatedAt: string | null;
  fingerprint: string;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanUpper(value: unknown) {
  return cleanString(value).toUpperCase();
}

function toNumberOrNull(value: unknown) {
  const raw = cleanString(value);
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIntOrNull(value: unknown) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function toTimeHHMMOrNull(value: unknown) {
  const raw = cleanString(value);
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function fingerprintForLogbookLikeEntry(input: {
  date: string;
  tailNumberSnapshot: string;
  origin: string;
  destination: string;
  timeOut?: string | null;
  timeIn?: string | null;
  hobbsOut?: number | null;
  hobbsIn?: number | null;
  totalTime?: number | null;
}) {
  const base = [
    input.date.trim(),
    input.tailNumberSnapshot.trim().toUpperCase(),
    input.origin.trim().toUpperCase(),
    input.destination.trim().toUpperCase(),
    input.timeOut ?? "",
    input.timeIn ?? "",
    input.hobbsOut ?? "",
    input.hobbsIn ?? "",
    input.totalTime ?? ""
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 24);
}

export function normalizeLogTenRows(
  rows: Record<string, string>[],
  mapping: LogTenMapping
): LogTenRowNormalized[] {
  return rows
    .map((row) => {
      const date = cleanString(row[mapping.date]);
      const tailNumberSnapshot = cleanUpper(row[mapping.tail]);
      const origin = cleanUpper(row[mapping.origin]);
      const destination = cleanUpper(row[mapping.destination]);
      if (!date || !tailNumberSnapshot || !origin) {
        return null;
      }

      const timeOut = mapping.timeOut ? toTimeHHMMOrNull(row[mapping.timeOut]) : null;
      const timeIn = mapping.timeIn ? toTimeHHMMOrNull(row[mapping.timeIn]) : null;
      const hobbsOut = mapping.hobbsOut ? toNumberOrNull(row[mapping.hobbsOut]) : null;
      const hobbsIn = mapping.hobbsIn ? toNumberOrNull(row[mapping.hobbsIn]) : null;

      const picTime = mapping.pic ? toNumberOrNull(row[mapping.pic]) : null;
      const sicTime = mapping.sic ? toNumberOrNull(row[mapping.sic]) : null;
      const dualReceivedTime = mapping.dualReceived
        ? toNumberOrNull(row[mapping.dualReceived])
        : null;
      const soloTime = mapping.solo ? toNumberOrNull(row[mapping.solo]) : null;
      const nightTime = mapping.night ? toNumberOrNull(row[mapping.night]) : null;
      const xcTime = mapping.xc ? toNumberOrNull(row[mapping.xc]) : null;
      const simulatedInstrumentTime = mapping.simInst
        ? toNumberOrNull(row[mapping.simInst])
        : null;
      const instrumentTime = mapping.actualInst ? toNumberOrNull(row[mapping.actualInst]) : null;
      const simulatorTime = mapping.simulator ? toNumberOrNull(row[mapping.simulator]) : null;
      const groundTime = mapping.ground ? toNumberOrNull(row[mapping.ground]) : null;

      const dayTakeoffs = mapping.dayTo ? toIntOrNull(row[mapping.dayTo]) : null;
      const dayLandings = mapping.dayLdg ? toIntOrNull(row[mapping.dayLdg]) : null;
      const nightTakeoffs = mapping.nightTo ? toIntOrNull(row[mapping.nightTo]) : null;
      const nightLandings = mapping.nightLdg ? toIntOrNull(row[mapping.nightLdg]) : null;

      const remarks = mapping.remarks ? cleanString(row[mapping.remarks]) || null : null;
      const externalId = mapping.externalId ? cleanString(row[mapping.externalId]) || null : null;
      const externalUpdatedAt = mapping.updatedAt
        ? cleanString(row[mapping.updatedAt]) || null
        : null;

      const fingerprint = fingerprintForLogbookLikeEntry({
        date,
        tailNumberSnapshot,
        origin,
        destination,
        timeOut,
        timeIn,
        hobbsOut,
        hobbsIn
      });

      return {
        date,
        tailNumberSnapshot,
        origin,
        destination,
        timeOut,
        timeIn,
        hobbsOut,
        hobbsIn,
        picTime,
        sicTime,
        dualReceivedTime,
        soloTime,
        nightTime,
        xcTime,
        simulatedInstrumentTime,
        instrumentTime,
        simulatorTime,
        groundTime,
        dayTakeoffs,
        dayLandings,
        nightTakeoffs,
        nightLandings,
        remarks,
        externalId,
        externalUpdatedAt,
        fingerprint
      };
    })
    .filter((row): row is LogTenRowNormalized => Boolean(row));
}

