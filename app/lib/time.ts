export function normalizeTimeOfDay(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Accept "HH:MM" or "HHMM" (and also tolerate "HMM").
  const digits = raw.replace(":", "").replace(/\s+/g, "");
  if (!/^\d{3,4}$/.test(digits)) return null;

  const padded = digits.length === 3 ? `0${digits}` : digits;
  const hh = Number(padded.slice(0, 2));
  const mm = Number(padded.slice(2, 4));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

