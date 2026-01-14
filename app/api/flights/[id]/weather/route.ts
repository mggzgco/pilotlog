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

type SourceKind = "TAF" | "METAR" | "NWS" | "NONE";
type WeatherSource = { kind: SourceKind; detail: string; url?: string | null };

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

function hoursBetween(now: Date, future: Date) {
  return (future.getTime() - now.getTime()) / (1000 * 60 * 60);
}

function mphToKt(mph: number) {
  return mph * 0.868976;
}

function parseNwsWindSpeedMph(raw: string | null) {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const m = t.match(/(\d+)(?:\s*to\s*(\d+))?\s*mph/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function compassToDeg(compass: string | null) {
  const t = (compass ?? "").trim().toUpperCase();
  if (!t) return null;
  const map: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5
  };
  return map[t] ?? null;
}

function wxFromText(text: string): WxKind {
  const t = text.toLowerCase();
  if (t.includes("thunder")) return "thunderstorm";
  if (t.includes("snow") || t.includes("sleet") || t.includes("flurr")) return "snow";
  if (t.includes("rain") || t.includes("showers") || t.includes("drizzle")) return "rain";
  if (t.includes("fog")) return "fog";
  if (t.includes("mist") || t.includes("haze")) return "mist";
  return "none";
}

function skyFromText(text: string): SkyCover {
  const t = text.toLowerCase();
  if (t.includes("clear") || t.includes("sunny")) return "clear";
  if (t.includes("mostly sunny")) return "few";
  if (t.includes("partly cloudy")) return "scattered";
  if (t.includes("mostly cloudy")) return "broken";
  if (t.includes("cloudy") || t.includes("overcast")) return "overcast";
  return "unknown";
}

function toTempC(temp: number, unit: string | null) {
  if (!Number.isFinite(temp)) return null;
  const u = (unit ?? "").toUpperCase();
  if (u === "C") return temp;
  if (u === "F") return ((temp - 32) * 5) / 9;
  return null;
}

async function fetchNwsForecastForTime({
  station,
  latitude,
  longitude,
  forTime
}: {
  station: string;
  latitude: number;
  longitude: number;
  forTime: Date;
}): Promise<{ metar: MetarParsed | null; source: WeatherSource }> {
  const ua = "FlightTraks (weather)"; // NWS requires a UA; keep it simple.
  const headers = { "User-Agent": ua, Accept: "application/geo+json" };

  const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
  const pointsRes = await fetch(pointsUrl, { headers, next: { revalidate: 3600 } });
  if (!pointsRes.ok) {
    return { metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable.", url: "https://api.weather.gov" } };
  }
  const pointsJson = (await pointsRes.json().catch(() => null)) as any;
  const forecastUrl = pointsJson?.properties?.forecast as string | undefined;
  if (!forecastUrl) {
    return { metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable.", url: "https://api.weather.gov" } };
  }

  const forecastRes = await fetch(forecastUrl, { headers, next: { revalidate: 3600 } });
  if (!forecastRes.ok) {
    return { metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable.", url: "https://api.weather.gov" } };
  }
  const forecastJson = (await forecastRes.json().catch(() => null)) as any;
  const periods = (forecastJson?.properties?.periods ?? []) as any[];
  if (!Array.isArray(periods) || periods.length === 0) {
    return { metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable.", url: "https://api.weather.gov" } };
  }

  const period =
    periods.find((p) => {
      const start = new Date(p?.startTime);
      const end = new Date(p?.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return forTime >= start && forTime < end;
    }) ?? periods[0];

  const shortForecast = typeof period?.shortForecast === "string" ? period.shortForecast : "Forecast";
  const windDirDeg = compassToDeg(typeof period?.windDirection === "string" ? period.windDirection : null);
  const windMph = parseNwsWindSpeedMph(typeof period?.windSpeed === "string" ? period.windSpeed : null);
  const speedKt = windMph !== null ? Math.round(mphToKt(windMph)) : null;
  const temperatureC = typeof period?.temperature === "number" ? toTempC(period.temperature, period.temperatureUnit ?? null) : null;

  const metar: MetarParsed = {
    station,
    observedAt: forTime.toISOString(),
    rawText: `NWS ${shortForecast}`,
    wind: { directionDeg: windDirDeg, speedKt, gustKt: null, variable: false },
    temperatureC,
    sky: { cover: skyFromText(shortForecast), ceilingFt: null },
    wx: { kind: wxFromText(shortForecast), token: shortForecast }
  };

  return {
    metar,
    source: {
      kind: "NWS",
      detail: "NWS 7-day grid forecast (12h periods).",
      url: forecastUrl
    }
  };
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
      originAirport: { select: { icao: true, iata: true, latitude: true, longitude: true } },
      destinationAirport: { select: { icao: true, iata: true, latitude: true, longitude: true } }
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
    return NextResponse.json({
      mode: "snapshot",
      snapshot: existingSnapshot,
      sources: {
        origin: { kind: "METAR", detail: "AviationWeather historical METAR at takeoff time.", url: "https://aviationweather.gov/api/data/metar" },
        destination: { kind: "METAR", detail: "AviationWeather historical METAR at landing time.", url: "https://aviationweather.gov/api/data/metar" }
      }
    });
  }

  const now = new Date();
  const plannedAt = flight.plannedStartTime ?? null;
  const plannedArrAt = flight.plannedEndTime ?? plannedAt;

  // Planned flights: show forecast via the generic aviation endpoint (live).
  if (plannedAt && plannedAt.getTime() > now.getTime()) {
    const maxTafHours = 24;
    const maxNwsHours = 7 * 24;

    const originStation =
      normalizeStation(flight.originAirport?.icao ?? flight.originAirport?.iata ?? null) ??
      (await resolveStation(flight.origin ?? null));
    const destStation =
      normalizeStation(flight.destinationAirport?.icao ?? flight.destinationAirport?.iata ?? null) ??
      (await resolveStation(flight.destination ?? null));

    const depHours = hoursBetween(now, plannedAt);
    const arrHours = plannedArrAt ? hoursBetween(now, plannedArrAt) : depHours;

    // <=24h: TAF when available, else current METAR fallback.
    if (depHours <= maxTafHours && arrHours <= maxTafHours) {
      const [originMetar, destMetar, originTaf, destTaf] = await Promise.all([
        originStation ? fetchCurrentMetar(originStation) : Promise.resolve(null),
        destStation ? fetchCurrentMetar(destStation) : Promise.resolve(null),
        originStation ? fetchCurrentTaf(originStation) : Promise.resolve(null),
        destStation ? fetchCurrentTaf(destStation) : Promise.resolve(null)
      ]);

      const originTempC = originMetar?.rawText
        ? parseMetar(originMetar.rawText, originStation!, originMetar.observedAt).temperatureC
        : null;
      const destTempC = destMetar?.rawText
        ? parseMetar(destMetar.rawText, destStation!, destMetar.observedAt).temperatureC
        : null;

      const originHasTaf = Boolean(originTaf?.rawText);
      const destHasTaf = Boolean(destTaf?.rawText);

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
        destination: destForecast,
        sources: {
          origin: originHasTaf
            ? ({ kind: "TAF", detail: "AviationWeather TAF (typically <= 24h).", url: "https://aviationweather.gov/api/data/taf" } satisfies WeatherSource)
            : ({ kind: "METAR", detail: "TAF unavailable; showing current METAR.", url: "https://aviationweather.gov/api/data/metar" } satisfies WeatherSource),
          destination: destHasTaf
            ? ({ kind: "TAF", detail: "AviationWeather TAF (typically <= 24h).", url: "https://aviationweather.gov/api/data/taf" } satisfies WeatherSource)
            : ({ kind: "METAR", detail: "TAF unavailable; showing current METAR.", url: "https://aviationweather.gov/api/data/metar" } satisfies WeatherSource)
        },
        notice: !originHasTaf || !destHasTaf ? "Some airports do not publish TAFs. Falling back to current METAR where needed." : null
      });
    }

    // 24h–7d: use NWS grid forecast if we have coordinates; otherwise provide a clear note.
    if (depHours <= maxNwsHours || arrHours <= maxNwsHours) {
      const originLat = flight.originAirport?.latitude ?? null;
      const originLon = flight.originAirport?.longitude ?? null;
      const destLat = flight.destinationAirport?.latitude ?? null;
      const destLon = flight.destinationAirport?.longitude ?? null;

      const [originNws, destNws] = await Promise.all([
        originStation && originLat !== null && originLon !== null
          ? fetchNwsForecastForTime({ station: originStation, latitude: originLat, longitude: originLon, forTime: plannedAt })
          : Promise.resolve({ metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable (missing airport coordinates).", url: "https://api.weather.gov" } as WeatherSource }),
        destStation && destLat !== null && destLon !== null
          ? fetchNwsForecastForTime({ station: destStation, latitude: destLat, longitude: destLon, forTime: plannedArrAt ?? plannedAt })
          : Promise.resolve({ metar: null, source: { kind: "NONE", detail: "NWS forecast unavailable (missing airport coordinates).", url: "https://api.weather.gov" } as WeatherSource })
      ]);

      return NextResponse.json({
        mode: "forecast",
        forTime: plannedAt.toISOString(),
        origin: originNws.metar,
        destination: destNws.metar,
        sources: { origin: originNws.source, destination: destNws.source },
        notice: "TAF coverage is typically <= 24h. For longer-range planned flights we use NWS grid forecasts (up to ~7 days)."
      });
    }

    // Too far out.
    return NextResponse.json({
      mode: "forecast",
      forTime: plannedAt.toISOString(),
      origin: null,
      destination: null,
      sources: {
        origin: { kind: "NONE", detail: "No forecast yet (too far in the future).", url: null } as WeatherSource,
        destination: { kind: "NONE", detail: "No forecast yet (too far in the future).", url: null } as WeatherSource
      },
      notice: "Forecasts are not available yet for this flight date. Check back closer to departure (<=7 days for NWS, <=24h for TAF)."
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

