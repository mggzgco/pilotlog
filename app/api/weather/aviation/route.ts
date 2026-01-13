import { NextResponse } from "next/server";

type MetarParsed = {
  station: string;
  observedAt: string | null;
  rawText: string;
  wind: { directionDeg: number | null; speedKt: number | null; gustKt: number | null; variable: boolean };
  temperatureC: number | null;
  sky: { cover: "clear" | "few" | "scattered" | "broken" | "overcast" | "unknown"; ceilingFt: number | null };
  wx: { kind: "none" | "rain" | "snow" | "thunderstorm" | "mist" | "fog" | "other"; token: string | null };
};

function normalizeStation(code: string | null) {
  const raw = (code ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z0-9]{4}$/.test(raw)) return raw;
  // Heuristic: 3-letter US IATA -> ICAO "Kxxx"
  if (/^[A-Z]{3}$/.test(raw)) return `K${raw}`;
  return null;
}

function parseMetar(rawText: string): Omit<MetarParsed, "station" | "observedAt"> {
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
    const kind: MetarParsed["wx"]["kind"] =
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
    // Determine predominant cover by "most overcast" token.
    const order: Record<string, number> = { SKC: 0, CLR: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
    const strongest = coverTokens.reduce((best, cur) => {
      const b = best.slice(0, 3);
      const c = cur.slice(0, 3);
      return (order[c] ?? -1) > (order[b] ?? -1) ? cur : best;
    }, coverTokens[0]!);
    const code = strongest.slice(0, 3);
    const cover: MetarParsed["sky"]["cover"] =
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

  return {
    rawText,
    wind,
    temperatureC,
    sky,
    wx
  };
}

async function fetchMetar(station: string) {
  // AviationWeather.gov provides a simple JSON endpoint (no key) for current METAR.
  // If this ever changes, the parser still works as long as we can get raw METAR text.
  const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(
    station
  )}&format=json`;
  const res = await fetch(url, {
    // Cache for a short period to avoid hammering the upstream and keep dashboard snappy.
    next: { revalidate: 600 }
  });
  if (!res.ok) {
    throw new Error(`METAR fetch failed (${res.status})`);
  }
  const json = (await res.json().catch(() => null)) as any;
  if (!Array.isArray(json) || json.length === 0) {
    return null;
  }
  const row = json[0] ?? null;
  const rawText =
    (typeof row?.rawOb === "string" ? row.rawOb : null) ??
    (typeof row?.raw_text === "string" ? row.raw_text : null) ??
    null;
  if (!rawText) return null;
  const observedAt =
    typeof row?.obsTime === "string"
      ? row.obsTime
      : typeof row?.observation_time === "string"
        ? row.observation_time
        : null;
  return { rawText, observedAt };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = normalizeStation(url.searchParams.get("origin"));
  const destination = normalizeStation(url.searchParams.get("destination"));

  if (!origin && !destination) {
    return NextResponse.json(
      { error: "Missing origin or destination station code." },
      { status: 400 }
    );
  }

  const getFor = async (station: string | null) => {
    if (!station) return null;
    const metar = await fetchMetar(station);
    if (!metar) return null;
    const parsed = parseMetar(metar.rawText);
    const result: MetarParsed = {
      station,
      observedAt: metar.observedAt,
      ...parsed
    };
    return result;
  };

  try {
    const [originMetar, destinationMetar] = await Promise.all([
      getFor(origin),
      getFor(destination)
    ]);
    return NextResponse.json({ origin: originMetar, destination: destinationMetar });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch weather.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

