"use client";

import { useEffect, useMemo, useState } from "react";

type TimeZoneSelectProps = {
  name: string;
  defaultValue?: string;
  className?: string;
};

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London"
];

export function TimeZoneSelect({ name, defaultValue, className }: TimeZoneSelectProps) {
  // Important: keep the server-rendered HTML deterministic to avoid hydration mismatches.
  // We start with a stable fallback list and only expand to supportedValuesOf on the client after mount.
  const [timeZones, setTimeZones] = useState<string[]>(FALLBACK_TIMEZONES);

  useEffect(() => {
    const supported = (Intl as any)?.supportedValuesOf?.("timeZone");
    if (Array.isArray(supported) && supported.length > 0) {
      setTimeZones(supported as string[]);
    }
  }, []);

  // Deterministic initial selection: prefer profile value; otherwise use UTC on first render.
  // After hydration, if no profile value exists, we can adopt the device time zone.
  const [value, setValue] = useState<string>(() => defaultValue ?? "UTC");

  useEffect(() => {
    if (defaultValue) {
      setValue(defaultValue);
      return;
    }
    try {
      const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (systemTz) setValue(systemTz);
    } catch {
      // ignore
    }
  }, [defaultValue]);

  const normalizedValue = useMemo(() => {
    return timeZones.includes(value) ? value : "UTC";
  }, [timeZones, value]);

  return (
    <select
      name={name}
      value={normalizedValue}
      onChange={(event) => setValue(event.target.value)}
      className={
        className ??
        "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      }
    >
      {timeZones.map((tz) => (
        <option key={tz} value={tz}>
          {tz}
        </option>
      ))}
    </select>
  );
}

