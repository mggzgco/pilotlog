import { cn } from "@/app/lib/utils";

const statusStyles: Record<
  string,
  { label: string; className: string }
> = {
  PLANNED: {
    label: "Planned",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
  },
  PREFLIGHT_SIGNED: {
    label: "Preflight signed",
    className:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100"
  },
  POSTFLIGHT_IN_PROGRESS: {
    label: "Postflight in progress",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100"
  },
  POSTFLIGHT_SIGNED: {
    label: "Postflight signed",
    className: "bg-sky-50 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100"
  },
  IMPORTED: {
    label: "Imported",
    className:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
  },
  COMPLETED: {
    label: "Completed",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100"
  }
};

type FlightStatusBadgeProps = {
  status: string;
  className?: string;
};

export function FlightStatusBadge({ status, className }: FlightStatusBadgeProps) {
  const style = statusStyles[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase(),
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
