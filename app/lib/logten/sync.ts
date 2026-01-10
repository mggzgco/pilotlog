import crypto from "crypto";
import { LogTenMapping } from "@/app/lib/logten/mapping";

export type LogTenRowNormalized = {
  date: string; // YYYY-MM-DD (as provided)
  tailNumberSnapshot: string;
  aircraftType: string | null;
  origin: string;
  route: string | null;
  destination: string;
  timeOut: string | null; // HH:MM
  timeIn: string | null; // HH:MM
  hobbsOut: number | null;
  hobbsIn: number | null;
  totalTime: number | null;
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
  picCrew: string | null;
  student: string | null;
  instructor: string | null;
  approach1: string | null;
  approach2: string | null;
  holds: string | null;
  flightReview: string | null;
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
  // LogTen exports often use "HHMM" (e.g. 1220) rather than "HH:MM"
  const matchColon = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (matchColon) {
    const hh = Number(matchColon[1]);
    const mm = Number(matchColon[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const matchHHMM = /^(\d{3,4})$/.exec(raw);
  if (matchHHMM) {
    const digits = matchHHMM[1].padStart(4, "0");
    const hh = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }
  return null;
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

      const aircraftType = mapping.aircraftType ? cleanString(row[mapping.aircraftType]) || null : null;
      const route = mapping.route ? cleanString(row[mapping.route]) || null : null;
      const timeOut = mapping.timeOut ? toTimeHHMMOrNull(row[mapping.timeOut]) : null;
      const timeIn = mapping.timeIn ? toTimeHHMMOrNull(row[mapping.timeIn]) : null;
      const hobbsOut = mapping.hobbsOut ? toNumberOrNull(row[mapping.hobbsOut]) : null;
      const hobbsIn = mapping.hobbsIn ? toNumberOrNull(row[mapping.hobbsIn]) : null;
      const totalTime = mapping.totalTime ? toNumberOrNull(row[mapping.totalTime]) : null;

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
      const picCrew = mapping.picCrew ? cleanString(row[mapping.picCrew]) || null : null;
      const student = mapping.student ? cleanString(row[mapping.student]) || null : null;
      const instructor = mapping.instructor ? cleanString(row[mapping.instructor]) || null : null;
      const approach1 = mapping.approach1 ? cleanString(row[mapping.approach1]) || null : null;
      const approach2 = mapping.approach2 ? cleanString(row[mapping.approach2]) || null : null;
      const holds = mapping.holds ? cleanString(row[mapping.holds]) || null : null;
      const flightReview = mapping.flightReview ? cleanString(row[mapping.flightReview]) || null : null;
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
        hobbsIn,
        totalTime
      });

      return {
        date,
        tailNumberSnapshot,
        aircraftType,
        origin,
        route,
        destination,
        timeOut,
        timeIn,
        hobbsOut,
        hobbsIn,
        totalTime,
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
        picCrew,
        student,
        instructor,
        approach1,
        approach2,
        holds,
        flightReview,
        remarks,
        externalId,
        externalUpdatedAt,
        fingerprint
      };
    })
    .filter((row): row is LogTenRowNormalized => Boolean(row));
}

