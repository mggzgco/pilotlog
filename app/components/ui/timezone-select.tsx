"use client";

import { useMemo } from "react";

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
  const timeZones = useMemo(() => {
    const supported = (Intl as any)?.supportedValuesOf?.("timeZone");
    if (Array.isArray(supported) && supported.length > 0) {
      return supported as string[];
    }
    return FALLBACK_TIMEZONES;
  }, []);

  const resolvedDefault = useMemo(() => {
    if (defaultValue && timeZones.includes(defaultValue)) return defaultValue;
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (systemTz && timeZones.includes(systemTz)) return systemTz;
    return "UTC";
  }, [defaultValue, timeZones]);

  return (
    <select
      name={name}
      defaultValue={resolvedDefault}
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

