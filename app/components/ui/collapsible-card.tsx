import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/lib/utils";

type CollapsibleCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function CollapsibleCard({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className
}: CollapsibleCardProps) {
  return (
    <Card className={className}>
      <details className="group" open={defaultOpen}>
        <summary className="list-none cursor-pointer select-none border-b border-slate-200 px-5 py-4 text-slate-900 dark:border-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{title}</div>
              {subtitle ? (
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {subtitle}
                </div>
              ) : null}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180 dark:text-slate-400" />
          </div>
        </summary>
        <div className={cn("px-5 py-4", subtitle ? "pt-4" : "pt-4")}>{children}</div>
      </details>
    </Card>
  );
}

