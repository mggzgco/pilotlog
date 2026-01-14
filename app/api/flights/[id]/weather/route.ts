import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { saveFlightWeatherSnapshot } from "@/app/lib/weather/snapshot";

type WxKind =
  | "none"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "mist"
  | "fog"
  | "other";

type SkyCover =
  | "clear"
  | "few"
  | "scattered"
  | "broken"
  | "overcast"
  | "unknown";

type MetarParsed = {
  station: string;
  observedAt: string | null;
  rawText: string;
  wind: { directionDeg: number | null; speedKt: number | null; gustKt: number | null; variable: boolean };
  temperatureC: number | null;
  sky: { cover: SkyCover; ceilingFt: number | null };
  wx: { kind: WxKind; token: string | null };
};

function normalizeStation(code: string | null) {
  const raw = (code ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z0-9]{4}$/.test(raw)) return raw;
  if (/^[A-Z]{3}$/.test(raw)) return `K${raw}`;
  return null;
}

async function resolveStation(label: string | null) {
  const normalized = normalizeStation(label);
  if (normalized) return normalized;
  const raw = (label ?? "").trim().toUpperCase();
  if (!raw) return null;
  const airport = await prisma.airport.findFirst({
    where: { OR: [{ icao: raw }, { iata: raw }, { icao: `K${raw}` }] },
    select: { icao: true, iata: true }
  });
  return normalizeStation(airport?.icao ?? airport?.iata ?? null);
}

async function fetchCurrentMetar(station: string) {
  const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(station)}&format=json`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  if (!Array.isArray(json) || json.length === 0) return null;
  const row = json[0] ?? null;
  const rawText =
    (typeof row?.rawOb === "string" ? row.rawOb : null) ??
    (typeof row?.raw_text === "string" ? row.raw_text : null) ??
    null;
  if (!rawText) return null;
  const observedAt =
    typeof row?.reportTime === "string"
      ? row.reportTime
      : typeof row?.report_time === "string"
        ? row.report_time
        : typeof row?.observation_time === "string"
          ? row.observation_time
          : null;
  return { rawText, observedAt };
}

async function fetchCurrentTaf(station: string) {
  // AviationWeather.gov supports a JSON TAF endpoint similar to METAR.
  const url = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(station)}&format=json`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  if (!Array.isArray(json) || json.length === 0) return null;
  const row = json[0] ?? null;
  const rawText =
    (typeof row?.rawTaf === "string" ? row.rawTaf : null) ??
    (typeof row?.raw_text === "string" ? row.raw_text : null) ??
    null;
  if (!rawText) return null;
  const issueTime =
    typeof row?.issueTime === "string"
      ? row.issueTime
      : typeof row?.issue_time === "string"
        ? row.issue_time
        : null;
  return { rawText, issueTime };
}

function parseMetar(rawText: string, station: string, observedAt: string | null): MetarParsed {
  const tokens = rawText.split(/\s+/).filter(Boolean);

  const wind = (() => {
    const t = tokens.find((x) => /^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(x)) ?? null;
    if (!t) return { directionDeg: null, speedKt: null, gustKt: null, variable: false };
    const variable = t.startsWith("VRB");
    const directionDeg = variable ? null : Number(t.slice(0, 3));
    const speedMatch = t.match(/^(?:VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT$/);
    const speedKt = speedMatch ? Number(speedMatch[1]) : null;
    const gustKt = speedMatch?.[2] ? Number(speedMatch[2]) : null;
    return {
      directionDeg: Number.isFinite(directionDeg as number) ? directionDeg : null,
      speedKt: Number.isFinite(speedKt as number) ? speedKt : null,
      gustKt: Number.isFinite(gustKt as number) ? gustKt : null,
      variable
    };
  })();

  const temperatureC = (() => {
    const t = tokens.find((x) => /^(M?\d{1,2})\/(M?\d{1,2})$/.test(x)) ?? null;
    if (!t) return null;
    const tempToken = t.split("/")[0]!;
    const sign = tempToken.startsWith("M") ? -1 : 1;
    const numeric = Number(tempToken.replace(/^M/, ""));
    return Number.isFinite(numeric) ? sign * numeric : null;
  })();

  const wx = (() => {
    const token =
      tokens.find((x) => /(TS|RA|SN|DZ|PL|GR|GS|FG|BR|HZ)/.test(x)) ?? null;
    if (!token) return { kind: "none" as const, token: null };
    const kind: WxKind =
      token.includes("TS") ? "thunderstorm" :
      token.includes("SN") ? "snow" :
      token.includes("RA") || token.includes("DZ") ? "rain" :
      token.includes("FG") ? "fog" :
      token.includes("BR") ? "mist" :
      "other";
    return { kind, token };
  })();

  const sky = (() => {
    const coverTokens = tokens.filter((x) => /^(SKC|CLR|FEW|SCT|BKN|OVC)\d{3}$/.test(x) || /^(SKC|CLR)$/.test(x));
    if (coverTokens.length === 0) {
      return { cover: "unknown" as const, ceilingFt: null };
    }
    const order: Record<string, number> = { SKC: 0, CLR: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
    const strongest = coverTokens.reduce((best, cur) => {
      const b = best.slice(0, 3);
      const c = cur.slice(0, 3);
      return (order[c] ?? -1) > (order[b] ?? -1) ? cur : best;
    }, coverTokens[0]!);
    const code = strongest.slice(0, 3);
    const cover: SkyCover =
      code === "SKC" || code === "CLR" ? "clear" :
      code === "FEW" ? "few" :
      code === "SCT" ? "scattered" :
      code === "BKN" ? "broken" :
      code === "OVC" ? "overcast" :
      "unknown";
    const ceilingFt = (() => {
      const m = strongest.match(/^(?:SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})$/);
      if (!m) return null;
      const hundreds = Number(m[1]);
      return Number.isFinite(hundreds) ? hundreds * 100 : null;
    })();
    return { cover, ceilingFt };
  })();

  return { station, observedAt: null, rawText, wind, temperatureC, sky, wx };
}

function parseTafForTime(rawText: string, station: string, forTimeUtc: Date, temperatureC: number | null): MetarParsed {
  // Very lightweight TAF parser: pick the most recent FM group <= forTime, then parse wind/sky/wx.
  const tokens = rawText.split(/\s+/).filter(Boolean);
  const fmIdxs: Array<{ idx: number; time: Date | null }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const m = t.match(/^FM(\d{2})(\d{2})(\d{2})$/);
    if (!m) continue;
    // FMDDHHMM in UTC, month/year inferred from forTime
    const day = Number(m[1]);
    const hour = Number(m[2]);
    const minute = Number(m[3]);
    const base = new Date(Date.UTC(forTimeUtc.getUTCFullYear(), forTimeUtc.getUTCMonth(), day, hour, minute, 0));
    fmIdxs.push({ idx: i, time: Number.isFinite(base.getTime()) ? base : null });
  }
  const chosenFm = fmIdxs
    .filter((f) => f.time && f.time.getTime() <= forTimeUtc.getTime())
    .sort((a, b) => (a.time!.getTime() - b.time!.getTime()))
    .pop();
  const startIdx = chosenFm ? chosenFm.idx + 1 : 0;
  const endIdx = (() => {
    if (!chosenFm) return tokens.length;
    const next = fmIdxs.find((f) => f.idx > chosenFm.idx);
    return next ? next.idx : tokens.length;
  })();
  const segment = tokens.slice(startIdx, endIdx);

  const wind = (() => {
    const t = segment.find((x) => /^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(x)) ?? null;
    if (!t) return { directionDeg: null, speedKt: null, gustKt: null, variable: false };
    const variable = t.startsWith("VRB");
    const directionDeg = variable ? null : Number(t.slice(0, 3));
    const speedMatch = t.match(/^(?:VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT$/);
    const speedKt = speedMatch ? Number(speedMatch[1]) : null;
    const gustKt = speedMatch?.[2] ? Number(speedMatch[2]) : null;
    return {
      directionDeg: Number.isFinite(directionDeg as number) ? directionDeg : null,
      speedKt: Number.isFinite(speedKt as number) ? speedKt : null,
      gustKt: Number.isFinite(gustKt as number) ? gustKt : null,
      variable
    };
  })();

  const wx = (() => {
    const token = segment.find((x) => /(TS|RA|SN|DZ|PL|GR|GS|FG|BR|HZ)/.test(x)) ?? null;
    if (!token) return { kind: "none" as const, token: null };
    const kind: WxKind =
      token.includes("TS") ? "thunderstorm" :
      token.includes("SN") ? "snow" :
      token.includes("RA") || token.includes("DZ") ? "rain" :
      token.includes("FG") ? "fog" :
      token.includes("BR") ? "mist" :
      "other";
    return { kind, token };
  })();

  const sky = (() => {
    const coverTokens = segment.filter((x) => /^(SKC|CLR|FEW|SCT|BKN|OVC)\d{3}$/.test(x) || /^(SKC|CLR)$/.test(x));
    if (coverTokens.length === 0) {
      return { cover: "unknown" as const, ceilingFt: null };
    }
    const order: Record<string, number> = { SKC: 0, CLR: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
    const strongest = coverTokens.reduce((best, cur) => {
      const b = best.slice(0, 3);
      const c = cur.slice(0, 3);
      return (order[c] ?? -1) > (order[b] ?? -1) ? cur : best;
    }, coverTokens[0]!);
    const code = strongest.slice(0, 3);
    const cover: SkyCover =
      code === "SKC" || code === "CLR" ? "clear" :
      code === "FEW" ? "few" :
      code === "SCT" ? "scattered" :
      code === "BKN" ? "broken" :
      code === "OVC" ? "overcast" :
      "unknown";
    const ceilingFt = (() => {
      const m = strongest.match(/^(?:SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})$/);
      if (!m) return null;
      const hundreds = Number(m[1]);
      return Number.isFinite(hundreds) ? hundreds * 100 : null;
    })();
    return { cover, ceilingFt };
  })();

  return { station, observedAt: null, rawText, wind, temperatureC, sky, wx };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      origin: true,
      destination: true,
      startTime: true,
      endTime: true,
      plannedStartTime: true,
      plannedEndTime: true,
      statsJson: true,
      originAirport: { select: { icao: true, iata: true } },
      destinationAirport: { select: { icao: true, iata: true } }
    }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const stats =
    flight.statsJson && typeof flight.statsJson === "object" && !Array.isArray(flight.statsJson)
      ? (flight.statsJson as Record<string, unknown>)
      : {};

  const existingSnapshot = (stats as any).weatherSnapshot ?? null;
  if (existingSnapshot && !existingSnapshot.unavailable) {
    return NextResponse.json({ mode: "snapshot", snapshot: existingSnapshot });
  }

  const now = new Date();
  const plannedAt = flight.plannedStartTime ?? null;
  const plannedArrAt = flight.plannedEndTime ?? plannedAt;

  // Planned flights: show forecast via the generic aviation endpoint (live).
  if (plannedAt && plannedAt.getTime() > now.getTime()) {
    const originStation =
      normalizeStation(flight.originAirport?.icao ?? flight.originAirport?.iata ?? null) ??
      (await resolveStation(flight.origin ?? null));
    const destStation =
      normalizeStation(flight.destinationAirport?.icao ?? flight.destinationAirport?.iata ?? null) ??
      (await resolveStation(flight.destination ?? null));

    const [originMetar, destMetar, originTaf, destTaf] = await Promise.all([
      originStation ? fetchCurrentMetar(originStation) : Promise.resolve(null),
      destStation ? fetchCurrentMetar(destStation) : Promise.resolve(null),
      originStation ? fetchCurrentTaf(originStation) : Promise.resolve(null),
      destStation ? fetchCurrentTaf(destStation) : Promise.resolve(null)
    ]);

    const originTempC = originMetar?.rawText ? parseMetar(originMetar.rawText, originStation!, originMetar.observedAt).temperatureC : null;
    const destTempC = destMetar?.rawText ? parseMetar(destMetar.rawText, destStation!, destMetar.observedAt).temperatureC : null;

    const originForecast =
      originStation && originTaf?.rawText
        ? parseTafForTime(originTaf.rawText, originStation, plannedAt, originTempC)
        : originStation && originMetar?.rawText
          ? parseMetar(originMetar.rawText, originStation, originMetar.observedAt)
          : null;
    const destForecast =
      destStation && destTaf?.rawText
        ? parseTafForTime(destTaf.rawText, destStation, plannedArrAt ?? plannedAt, destTempC)
        : destStation && destMetar?.rawText
          ? parseMetar(destMetar.rawText, destStation, destMetar.observedAt)
          : null;

    return NextResponse.json({
      mode: "forecast",
      forTime: plannedAt.toISOString(),
      origin: originForecast,
      destination: destForecast
    });
  }

  // Completed / past flights: attempt a one-time snapshot capture (historical METAR lookup) and return it.
  // If history isn't available, the snapshot will be stored as unavailable.
  await saveFlightWeatherSnapshot({ flightId: flight.id });

  const refreshed = await prisma.flight.findFirst({
    where: { id: flight.id, userId: user.id },
    select: { statsJson: true }
  });
  const refreshedStats =
    refreshed?.statsJson && typeof refreshed.statsJson === "object" && !Array.isArray(refreshed.statsJson)
      ? (refreshed.statsJson as Record<string, unknown>)
      : {};
  const snapshot = (refreshedStats as any).weatherSnapshot ?? null;
  const debug = new URL(request.url).searchParams.get("debug") === "1";

  return NextResponse.json({
    mode: snapshot ? "snapshot" : "unavailable",
    snapshot,
    ...(debug
      ? {
          debug: {
            originResolved:
              normalizeStation(flight.originAirport?.icao ?? flight.originAirport?.iata ?? null) ??
              (await resolveStation(flight.origin ?? null)),
            destinationResolved:
              normalizeStation(flight.destinationAirport?.icao ?? flight.destinationAirport?.iata ?? null) ??
              (await resolveStation(flight.destination ?? null)),
            usedTimes: {
              startTime: flight.startTime ? flight.startTime.toISOString() : null,
              endTime: flight.endTime ? flight.endTime.toISOString() : null,
              plannedStartTime: flight.plannedStartTime ? flight.plannedStartTime.toISOString() : null,
              plannedEndTime: flight.plannedEndTime ? flight.plannedEndTime.toISOString() : null
            }
          }
        }
      : {})
  });
}

