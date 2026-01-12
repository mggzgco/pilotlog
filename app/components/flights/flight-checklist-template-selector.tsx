"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui/toast-provider";

type ChecklistPhase = "PREFLIGHT" | "POSTFLIGHT";

type TemplateOption = {
  id: string;
  name: string;
};

export function FlightChecklistTemplateSelector(props: {
  flightId: string;
  phase: ChecklistPhase;
  templates: TemplateOption[];
  defaultTemplateId: string | null;
  selectedTemplateId: string | null;
  disabled?: boolean;
}) {
  const { flightId, phase, templates, defaultTemplateId, selectedTemplateId, disabled } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const selectedValue = selectedTemplateId ?? "";

  const label = phase === "PREFLIGHT" ? "Pre-flight template" : "Post-flight template";

  const defaultLabel = useMemo(() => {
    if (!defaultTemplateId) return "Aircraft default (none assigned)";
    const t = templates.find((x) => x.id === defaultTemplateId);
    return t ? `Aircraft default: ${t.name}` : "Aircraft default";
  }, [defaultTemplateId, templates]);

  return (
    <div className="mt-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <select
        className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        value={selectedValue}
        disabled={Boolean(disabled || isSaving)}
        onChange={async (event) => {
          const nextId = event.target.value || null;
          setIsSaving(true);
          try {
            const res = await fetch(`/api/flights/${flightId}/checklists/select-template`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ phase, templateId: nextId })
            });
            const json = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!res.ok) {
              addToast(json?.error || "Failed to update checklist template.", "error");
              return;
            }
            addToast("Checklist template updated.", "success");
            router.refresh();
          } finally {
            setIsSaving(false);
          }
        }}
      >
        <option value="">{defaultLabel}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Applies to this flight. After the checklist is started, changing templates is disabled.
      </p>
    </div>
  );
}

