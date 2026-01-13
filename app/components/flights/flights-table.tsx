import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";
import { FlightRowMenu } from "@/app/components/flights/flight-row-menu";
import { formatDateTime24 } from "@/app/lib/utils";

export interface FlightRow {
  id: string;
  displayTime: string;
  tailNumber: string;
  tailNumberSnapshot?: string | null;
  origin: string;
  destination: string | null;
  routeLabel: string;
  status: string;
  checklistsStatus: string;
  logbookStatus: string;
  costsStatus: string;
  adsbStatus: string;
  nextAction:
    | { type: "link"; label: string; href: string }
    | { type: "form"; label: string; action: string };
  menuItems: Array<{ label: string; href: string }>;
}

interface FlightsTableProps {
  flights: FlightRow[];
  currentSort?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}

export function FlightsTable({ flights, currentSort, searchParams }: FlightsTableProps) {
  const buildSortHref = (sort: string) => {
    const params = new URLSearchParams();
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else if (String(value).length > 0) {
          params.set(key, String(value));
        }
      }
    }
    params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/flights?${qs}` : "/flights";
  };

  const sortLabel = (label: string, asc: string, desc: string) => {
    const activeAsc = currentSort === asc;
    const activeDesc = currentSort === desc;
    const next = activeDesc ? asc : desc;
    const arrow = activeAsc ? " ↑" : activeDesc ? " ↓" : "";
    return (
      <Link href={buildSortHref(next)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100">
        <span>{label}</span>
        <span className="text-[11px] text-slate-400">{arrow}</span>
      </Link>
    );
  };
  const decisionBadge = (decision: string) => {
    if (decision === "Complete") {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          Complete
        </span>
      );
    }
    if (decision === "Added") {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          Added
        </span>
      );
    }
    if (decision === "In progress" || decision === "Open") {
      return (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          {decision}
        </span>
      );
    }
    if (decision === "Pending") {
      return (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Pending
        </span>
      );
    }
    return (
      <span className="text-xs uppercase tracking-wide text-slate-500">—</span>
    );
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                {sortLabel("Date/time", "date_asc", "date_desc")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {sortLabel("Aircraft", "tail_asc", "tail_desc")}
              </th>
              <th className="px-4 py-3 text-left font-medium">Route</th>
              <th className="px-4 py-3 text-left font-medium">
                {sortLabel("Status", "status_asc", "status_desc")}
              </th>
              <th className="px-4 py-3 text-left font-medium">Checklists</th>
              <th className="px-4 py-3 text-left font-medium">Logbook</th>
              <th className="px-4 py-3 text-left font-medium">Costs</th>
              <th className="px-4 py-3 text-left font-medium">ADS-B</th>
              <th className="px-4 py-3 text-right font-medium">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {flights.map((flight) => (
              <tr
                key={flight.id}
                className="text-slate-900 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900/40"
              >
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {formatDateTime24(new Date(flight.displayTime))}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {flight.tailNumberSnapshot ?? flight.tailNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {flight.routeLabel}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    <FlightStatusBadge status={flight.status} />
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {decisionBadge(flight.checklistsStatus)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {decisionBadge(flight.logbookStatus)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {decisionBadge(flight.costsStatus)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {flight.adsbStatus === "Complete" ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                        Complete
                      </span>
                    ) : (
                      <span className="text-xs uppercase tracking-wide text-slate-500">—</span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {flight.nextAction.type === "form" ? (
                      <form action={flight.nextAction.action} method="post">
                        <Button size="sm" type="submit">
                          {flight.nextAction.label}
                        </Button>
                      </form>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href={flight.nextAction.href}>{flight.nextAction.label}</Link>
                      </Button>
                    )}
                    <FlightRowMenu flightId={flight.id} menuItems={flight.menuItems} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
