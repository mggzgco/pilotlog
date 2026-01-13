"use client";

import { useEffect, useState } from "react";
import { Input } from "@/app/components/ui/input";
import { normalizeTimeOfDay } from "@/app/lib/time";

type TimeOfDayInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function TimeOfDayInput({
  name,
  defaultValue = "",
  placeholder = "HH:MM",
  required,
  className
}: TimeOfDayInputProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  return (
    <Input
      name={name}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      required={required}
      className={className}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        // Auto-format once the user has typed exactly 4 digits (e.g. 0719 -> 07:19).
        if (/^\d{4}$/.test(next)) {
          const normalized = normalizeTimeOfDay(next);
          setValue(normalized ?? next);
          return;
        }
        setValue(next);
      }}
      onBlur={() => {
        const normalized = normalizeTimeOfDay(value);
        if (normalized && normalized !== value) {
          setValue(normalized);
        }
      }}
    />
  );
}

