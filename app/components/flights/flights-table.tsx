import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";

export interface FlightRow {
  id: string;
  displayTime: string;
  tailNumber: string;
  tailNumberSnapshot?: string | null;
  origin: string;
  destination: string | null;
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
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
          Accepted
        </span>
      );
    }
    if (decision === "Rejected") {
      return (
        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
          Rejected
        </span>
      );
    }
    return (
      <span className="text-xs uppercase tracking-wide text-slate-500">—</span>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-500">
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
        <tbody className="divide-y divide-slate-800">
          {flights.map((flight) => (
            <tr key={flight.id} className="text-slate-200 hover:bg-slate-900/60">
              <td className="px-4 py-3 text-slate-400">
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
                  {flight.destination ? (
                    <>
                      {flight.origin} → {flight.destination}
                    </>
                  ) : (
                    <span className="text-slate-400">{flight.origin} → —</span>
                  )}
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
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-200">
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
                  <details className="relative">
                    <summary className="list-none rounded-md border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800">
                      <MoreHorizontal className="h-4 w-4" />
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-slate-800 bg-slate-950 py-2 text-sm text-slate-200 shadow-lg">
                      {flight.menuItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-3 py-2 transition hover:bg-slate-900"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-slate-800" />
                      <form
                        action={`/api/flights/${flight.id}/delete`}
                        method="post"
                      >
                        <button
                          type="submit"
                          className="block w-full px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/10"
                        >
                          Delete flight
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
