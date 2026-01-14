import { prisma } from "@/app/lib/db";

export type WxKind =
  | "none"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "mist"
  | "fog"
  | "other";

export type SkyCover =
  | "clear"
  | "few"
  | "scattered"
  | "broken"
  | "overcast"
  | "unknown";

export type MetarParsed = {
  station: string;
  observedAt: string | null;
  rawText: string;
  wind: {
    directionDeg: number | null;
    speedKt: number | null;
    gustKt: number | null;
    variable: boolean;
  };
  temperatureC: number | null;
  sky: { cover: SkyCover; ceilingFt: number | null };
  wx: { kind: WxKind; token: string | null };
};

export type FlightWeatherSnapshot = {
  version: 1;
  capturedAt: string;
  // If we couldn't retrieve historical data (or no station), keep an explicit flag.
  unavailable?: boolean;
  origin?: MetarParsed | null;
  destination?: MetarParsed | null;
  notes?: string | null;
};

function normalizeStation(code: string | null) {
  const raw = (code ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z0-9]{4}$/.test(raw)) return raw;
  // Heuristic: 3-letter US IATA -> ICAO "Kxxx"
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

  return {
    station,
    observedAt,
    rawText,
    wind,
    temperatureC,
    sky,
    wx
  };
}

async function fetchDataserverCsv(url: string) {
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`AWC dataserver failed (${res.status})`);
  }
  return await res.text();
}

function pickLatestRawTextFromCsv(csv: string) {
  // AWC dataserver CSV typically includes a header row with "raw_text" and then data rows.
  // We just want the latest row's raw_text.
  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  // Find header that includes raw_text.
  const headerIdx = lines.findIndex((l) => l.toLowerCase().includes("raw_text"));
  if (headerIdx === -1) return null;
  const header = lines[headerIdx]!.split(",").map((h) => h.trim().toLowerCase());
  const rawTextIndex = header.indexOf("raw_text");
  const obsTimeIndex = header.indexOf("observation_time");
  if (rawTextIndex === -1) return null;

  const dataLines = lines.slice(headerIdx + 1).filter((l) => !l.toLowerCase().startsWith("no data"));
  if (dataLines.length === 0) return null;

  const parseRow = (line: string) => {
    // raw_text is quoted and can contain commas; handle a basic CSV with quoted fields.
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          cur += "\"";
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);

    const rawText = cells[rawTextIndex]?.trim() ?? null;
    const observedAt = obsTimeIndex !== -1 ? (cells[obsTimeIndex]?.trim() ?? null) : null;
    return { rawText: rawText || null, observedAt: observedAt || null };
  };

  // latest row is last
  const last = parseRow(dataLines[dataLines.length - 1]!);
  return last.rawText ? last : null;
}

async function fetchHistoricalMetar(station: string, at: Date) {
  // AviationWeather migrated off dataserver.php. Use the new Data API which supports a
  // historical lookup via `date=` (returns the METAR valid at/just before the time).
  const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(
    station
  )}&format=json&date=${encodeURIComponent(at.toISOString())}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`METAR historical fetch failed (${res.status})`);
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
    typeof row?.reportTime === "string"
      ? row.reportTime
      : typeof row?.report_time === "string"
        ? row.report_time
        : null;
  return { rawText, observedAt };
}

export async function saveFlightWeatherSnapshot({
  flightId
}: {
  flightId: string;
}) {
  const flight = await prisma.flight.findFirst({
    where: { id: flightId },
    select: {
      id: true,
      userId: true,
      origin: true,
      destination: true,
      startTime: true,
      endTime: true,
      plannedStartTime: true,
      statsJson: true,
      originAirport: { select: { icao: true } },
      destinationAirport: { select: { icao: true } }
    }
  });
  if (!flight) return;

  const startAt = flight.startTime;
  const endAt = flight.endTime ?? flight.startTime;
  const originStation =
    normalizeStation(flight.originAirport?.icao ?? null) ?? (await resolveStation(flight.origin ?? null));
  const destStation =
    normalizeStation(flight.destinationAirport?.icao ?? null) ??
    (await resolveStation(flight.destination ?? null));

  const existingStats =
    flight.statsJson && typeof flight.statsJson === "object" && !Array.isArray(flight.statsJson)
      ? (flight.statsJson as Record<string, unknown>)
      : {};

  // Don't overwrite a real snapshot.
  const existingSnapshot = (existingStats as any).weatherSnapshot as FlightWeatherSnapshot | undefined;
  if (existingSnapshot && !existingSnapshot.unavailable) {
    return;
  }

  const capturedAt = new Date().toISOString();

  try {
    const [originMetar, destMetar] = await Promise.all([
      originStation ? fetchHistoricalMetar(originStation, startAt) : Promise.resolve(null),
      destStation ? fetchHistoricalMetar(destStation, endAt) : Promise.resolve(null)
    ]);

    const snapshot: FlightWeatherSnapshot = {
      version: 1,
      capturedAt,
      unavailable: !originMetar && !destMetar,
      origin: originMetar?.rawText ? parseMetar(originMetar.rawText, originStation!, originMetar.observedAt) : null,
      destination: destMetar?.rawText ? parseMetar(destMetar.rawText, destStation!, destMetar.observedAt) : null,
      notes: !originStation && !destStation ? "No station codes available for this flight." : null
    };

    await prisma.flight.update({
      where: { id: flight.id },
      data: {
        statsJson: {
          ...(existingStats as any),
          weatherSnapshot: snapshot
        } as any
      }
    });
  } catch (error) {
    const snapshot: FlightWeatherSnapshot = {
      version: 1,
      capturedAt,
      unavailable: true,
      origin: null,
      destination: null,
      notes: error instanceof Error ? error.message : "Weather unavailable."
    };
    await prisma.flight.update({
      where: { id: flight.id },
      data: {
        statsJson: {
          ...(existingStats as any),
          weatherSnapshot: snapshot
        } as any
      }
    });
  }
}

