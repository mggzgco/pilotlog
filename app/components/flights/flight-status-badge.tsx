import { cn } from "@/app/lib/utils";

const statusStyles: Record<
  string,
  { label: string; className: string }
> = {
  PLANNED: {
    label: "Planned",
    className: "bg-slate-800 text-slate-200"
  },
  PREFLIGHT_SIGNED: {
    label: "Preflight signed",
    className: "bg-indigo-500/20 text-indigo-100"
  },
  POSTFLIGHT_IN_PROGRESS: {
    label: "Postflight in progress",
    className: "bg-amber-500/20 text-amber-100"
  },
  POSTFLIGHT_SIGNED: {
    label: "Postflight signed",
    className: "bg-sky-500/20 text-sky-100"
  },
  IMPORTED: {
    label: "Imported",
    className: "bg-emerald-500/20 text-emerald-100"
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-500/30 text-emerald-100"
  }
};

type FlightStatusBadgeProps = {
  status: string;
  className?: string;
};

export function FlightStatusBadge({ status, className }: FlightStatusBadgeProps) {
  const style = statusStyles[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase(),
    className: "bg-slate-800 text-slate-200"
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
