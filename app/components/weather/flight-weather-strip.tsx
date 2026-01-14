"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, Thermometer, Wind, Navigation2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";

type WeatherSnapshot = {
  version: 1;
  capturedAt: string;
  unavailable?: boolean;
  origin?: MetarParsed | null;
  destination?: MetarParsed | null;
  notes?: string | null;
};

type WeatherResponse =
  | { mode: "snapshot"; snapshot: WeatherSnapshot; sources?: Record<string, any>; notice?: string | null }
  | {
      mode: "forecast";
      origin: MetarParsed | null;
      destination: MetarParsed | null;
      forTime: string;
      sources?: { origin?: { kind: string; detail: string; url?: string | null }; destination?: { kind: string; detail: string; url?: string | null } };
      notice?: string | null;
    }
  | { mode: "unavailable"; snapshot: null }
  | { error: string };

type MetarParsed = {
  station: string;
  observedAt: string | null;
  rawText: string;
  wind: { directionDeg: number | null; speedKt: number | null; gustKt: number | null; variable: boolean };
  temperatureC: number | null;
  sky: { cover: "clear" | "few" | "scattered" | "broken" | "overcast" | "unknown"; ceilingFt: number | null };
  wx: { kind: "none" | "rain" | "snow" | "thunderstorm" | "mist" | "fog" | "other"; token: string | null };
};

type TempUnit = "C" | "F";
type StationChoice = "origin" | "destination";

function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      setValue(JSON.parse(raw) as T);
    } catch {
      // ignore
    }
  }, [key]);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function SkyIcon({ metar }: { metar: MetarParsed | null }) {
  if (!metar) return <Cloud className="h-4 w-4 text-slate-400" />;
  if (metar.wx.kind === "thunderstorm") return <CloudLightning className="h-4 w-4 text-amber-500" />;
  if (metar.wx.kind === "snow") return <CloudSnow className="h-4 w-4 text-sky-500" />;
  if (metar.wx.kind === "rain") return <CloudRain className="h-4 w-4 text-sky-600" />;
  if (metar.wx.kind === "fog") return <CloudFog className="h-4 w-4 text-slate-500" />;
  if (metar.wx.kind === "mist") return <CloudDrizzle className="h-4 w-4 text-slate-500" />;
  if (metar.sky.cover === "clear") return <Sun className="h-4 w-4 text-amber-500" />;
  if (metar.sky.cover === "few" || metar.sky.cover === "scattered") return <CloudSun className="h-4 w-4 text-amber-500" />;
  return <Cloud className="h-4 w-4 text-slate-500" />;
}

function skyLabel(metar: MetarParsed | null) {
  if (!metar) return "—";
  const cover = metar.sky.cover;
  const coverText =
    cover === "clear" ? "Clear" :
    cover === "few" ? "Few" :
    cover === "scattered" ? "Scattered" :
    cover === "broken" ? "Broken" :
    cover === "overcast" ? "Overcast" :
    "Unknown";
  const ceiling = metar.sky.ceilingFt ? ` · ${metar.sky.ceilingFt} ft` : "";
  const wx = metar.wx.kind !== "none" ? ` · ${metar.wx.token ?? metar.wx.kind}` : "";
  return `${coverText}${ceiling}${wx}`;
}

function windLabel(metar: MetarParsed | null) {
  if (!metar) return "—";
  const spd = metar.wind?.speedKt ?? null;
  const dirDeg = metar.wind?.directionDeg ?? null;
  const gustKt = metar.wind?.gustKt ?? null;
  const variable = Boolean(metar.wind?.variable);

  if (spd === null) return "—";
  if (spd === 0) return "Calm";

  const gust = gustKt !== null && gustKt > 0 ? `G${gustKt}` : "";
  const dir = variable ? "VRB" : dirDeg !== null ? dirDeg.toString().padStart(3, "0") : "—";
  return `${dir}° ${spd}${gust} kt`;
}

function tempLabel(metar: MetarParsed | null, unit: TempUnit) {
  if (!metar || metar.temperatureC === null) return "—";
  if (unit === "C") return `${metar.temperatureC.toFixed(0)}°C`;
  return `${cToF(metar.temperatureC).toFixed(0)}°F`;
}

export function FlightWeatherStrip({
  flightId,
  className
}: {
  flightId: string | null;
  className?: string;
}) {
  const [unit, setUnit] = useLocalStorageState<TempUnit>("pilotlog.tempUnit", "F");
  const [stationChoice, setStationChoice] = useState<StationChoice>("origin");
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!flightId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/flights/${encodeURIComponent(flightId)}/weather`, {
      headers: { accept: "application/json" }
    })
      .then((r) => r.json())
      .then((json: WeatherResponse) => {
        if (cancelled) return;
        setData(json);
      })
      .catch(() => {
        if (cancelled) return;
        setData({ error: "Failed to load weather." });
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flightId]);

  const active = useMemo(() => {
    const originMetar =
      data && "mode" in data && data.mode === "forecast"
        ? data.origin ?? null
        : data && "mode" in data && data.mode === "snapshot"
          ? data.snapshot?.origin ?? null
          : null;
    const destMetar =
      data && "mode" in data && data.mode === "forecast"
        ? data.destination ?? null
        : data && "mode" in data && data.mode === "snapshot"
          ? data.snapshot?.destination ?? null
          : null;
    if (stationChoice === "destination") return destMetar ?? originMetar;
    return originMetar ?? destMetar;
  }, [data, stationChoice]);

  const snapshot =
    data && "mode" in data && data.mode === "snapshot" ? data.snapshot : null;
  const originLabel =
    (data && "mode" in data && data.mode === "forecast" ? data.origin?.station : null) ??
    snapshot?.origin?.station ??
    "DEP";
  const destLabel =
    (data && "mode" in data && data.mode === "forecast" ? data.destination?.station : null) ??
    snapshot?.destination?.station ??
    "ARR";

  const sourceFor = (which: StationChoice) => {
    if (!data || !("mode" in data)) return null;
    if (data.mode === "forecast") {
      return which === "origin" ? data.sources?.origin?.kind ?? null : data.sources?.destination?.kind ?? null;
    }
    if (data.mode === "snapshot") {
      return "METAR";
    }
    return null;
  };

  const sourceDetailFor = (which: StationChoice) => {
    if (!data || !("mode" in data)) return null;
    if (data.mode === "forecast") {
      return which === "origin" ? data.sources?.origin?.detail ?? null : data.sources?.destination?.detail ?? null;
    }
    if (data.mode === "snapshot") {
      return "Snapshot captured from historical METAR at takeoff/landing time.";
    }
    return null;
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40",
        className
      )}
      title={active?.rawText ?? ""}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] dark:border-slate-800 dark:bg-slate-900/60">
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-0.5 font-semibold",
                stationChoice === "origin"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-300"
              )}
              onClick={() => setStationChoice("origin")}
            >
              DEP · {originLabel}
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-0.5 font-semibold",
                stationChoice === "destination"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-300"
              )}
              onClick={() => setStationChoice("destination")}
            >
              ARR · {destLabel}
            </button>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {loading
              ? "Loading weather…"
              : data && "mode" in data && data.mode === "forecast"
                ? `Forecast (${sourceFor(stationChoice) ?? "—"})`
                : active?.observedAt
                  ? `METAR ${active.observedAt}`
                  : snapshot?.capturedAt
                    ? `Saved · ${new Date(snapshot.capturedAt).toLocaleString()}`
                    : "Weather"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUnit((u) => (u === "C" ? "F" : "C"))}
            className="h-6 px-2 text-[10px]"
            title="Toggle temperature units"
          >
            °{unit === "C" ? "C" : "F"}
          </Button>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <SkyIcon metar={active} />
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Sky</p>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-600 dark:text-slate-300">
            {skyLabel(active)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <div className="relative h-4 w-4">
              <Wind className="h-4 w-4 text-slate-500 dark:text-slate-300" />
              {active?.wind?.directionDeg !== null && (active?.wind?.speedKt ?? 0) > 0 ? (
                <Navigation2
                  className="absolute -right-1 -top-1 h-3 w-3 text-slate-700 dark:text-slate-200"
                  style={{ transform: `rotate(${active?.wind.directionDeg ?? 0}deg)` }}
                />
              ) : null}
            </div>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Wind</p>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-600 dark:text-slate-300">
            {windLabel(active)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Temp</p>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-600 dark:text-slate-300">
            {tempLabel(active, unit)}
          </p>
        </div>
      </div>

      {data && "mode" in data && (data as any).notice ? (
        <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400" title={(data as any).notice}>
          {(data as any).notice}
        </p>
      ) : (
        <p
          className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400"
          title={sourceDetailFor(stationChoice) ?? ""}
        >
          {sourceDetailFor(stationChoice) ? `Source: ${sourceDetailFor(stationChoice)}` : ""}
        </p>
      )}

      {data && "error" in data ? (
        <p className="mt-1 truncate text-[10px] text-rose-600 dark:text-rose-300">
          {data.error}
        </p>
      ) : snapshot?.unavailable && !loading ? (
        <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">
          Weather unavailable for this flight.
        </p>
      ) : null}
    </div>
  );
}

