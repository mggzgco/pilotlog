import { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-left",
        className
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-brand-400">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}
