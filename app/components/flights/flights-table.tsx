import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";
import { FlightRowMenu } from "@/app/components/flights/flight-row-menu";

export interface FlightRow {
  id: string;
  displayTime: string;
  tailNumber: string;
  tailNumberSnapshot?: string | null;
  origin: string;
  destination: string | null;
  routeLabel: string;
  status: string;
  preflightDecision: string;
  postflightDecision: string;
  adsbStatus: string;
  nextAction:
    | { type: "link"; label: string; href: string }
    | { type: "form"; label: string; action: string };
  menuItems: Array<{ label: string; href: string }>;
}

interface FlightsTableProps {
  flights: FlightRow[];
}

export function FlightsTable({ flights }: FlightsTableProps) {
  const decisionBadge = (decision: string) => {
    if (decision === "Accepted") {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          Accepted
        </span>
      );
    }
    if (decision === "Rejected") {
      return (
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
          Rejected
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
              <th className="px-4 py-3 text-left font-medium">Date/time</th>
              <th className="px-4 py-3 text-left font-medium">Aircraft</th>
              <th className="px-4 py-3 text-left font-medium">Route</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Preflight</th>
              <th className="px-4 py-3 text-left font-medium">Postflight</th>
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
                    {new Date(flight.displayTime).toLocaleString()}
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
                    {decisionBadge(flight.preflightDecision)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {decisionBadge(flight.postflightDecision)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/flights/${flight.id}`}
                    className="block -mx-4 -my-3 px-4 py-3"
                  >
                    {flight.adsbStatus === "Imported" ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                        Imported
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
