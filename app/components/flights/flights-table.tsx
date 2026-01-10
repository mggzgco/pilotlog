"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";

type SortKey = "date" | "duration" | "cost";
type SortDirection = "asc" | "desc";

export interface FlightRow {
  id: string;
  sortTime: string;
  displayTime: string;
  tailNumber: string;
  tailNumberSnapshot?: string | null;
  origin: string;
  destination: string | null;
  durationMinutes: number | null;
  distanceNm: number | null;
  costTotalCents: number;
  status: string;
  isImported: boolean;
}

interface FlightsTableProps {
  flights: FlightRow[];
}

export function FlightsTable({ flights }: FlightsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [direction, setDirection] = useState<SortDirection>("desc");

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
      }),
    []
  );

  const sortedFlights = useMemo(() => {
    const valueFor = (flight: FlightRow) => {
      if (sortKey === "duration") {
        return flight.durationMinutes ?? -1;
      }
      if (sortKey === "cost") {
        return flight.costTotalCents ?? -1;
      }
      return new Date(flight.sortTime).getTime();
    };

    return [...flights].sort((a, b) => {
      const first = valueFor(a);
      const second = valueFor(b);
      if (first === second) {
        return 0;
      }
      return direction === "asc" ? first - second : second - first;
    });
  }, [direction, flights, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection("desc");
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return direction === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const headerButtonClass = (key: SortKey) =>
    cn(
      "flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 transition hover:text-slate-200",
      sortKey === key && "text-slate-200"
    );

  const ariaSortValue = (key: SortKey) => {
    if (sortKey !== key) {
      return "none" as const;
    }
    return direction === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium" aria-sort={ariaSortValue("date")}>
              <button type="button" className={headerButtonClass("date")} onClick={() => handleSort("date")}>
                Date {sortIcon("date")}
              </button>
            </th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Tail</th>
            <th className="px-4 py-3 text-left font-medium">Route</th>
            <th
              className="px-4 py-3 text-right font-medium"
              aria-sort={ariaSortValue("duration")}
            >
              <button type="button" className={headerButtonClass("duration")} onClick={() => handleSort("duration")}>
                Duration {sortIcon("duration")}
              </button>
            </th>
            <th className="px-4 py-3 text-right font-medium">Distance</th>
            <th className="px-4 py-3 text-right font-medium" aria-sort={ariaSortValue("cost")}>
              <button type="button" className={headerButtonClass("cost")} onClick={() => handleSort("cost")}>
                Cost {sortIcon("cost")}
              </button>
            </th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedFlights.map((flight) => (
            <tr key={flight.id} className="text-slate-200 hover:bg-slate-900/60">
              <td className="px-4 py-3 text-slate-400">
                {new Date(flight.displayTime).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <FlightStatusBadge status={flight.status} />
              </td>
              <td className="px-4 py-3">
                {flight.tailNumberSnapshot ?? flight.tailNumber}
              </td>
              <td className="px-4 py-3">
                {flight.destination ? (
                  <>
                    {flight.origin} → {flight.destination}
                  </>
                ) : (
                  <span className="text-slate-400">
                    {flight.origin} → —
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-slate-400">
                {flight.isImported && flight.durationMinutes !== null
                  ? `${flight.durationMinutes} mins`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-slate-400">
                {flight.isImported && flight.distanceNm !== null
                  ? `${flight.distanceNm} nm`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-slate-400">
                {flight.costTotalCents > 0
                  ? currencyFormatter.format(flight.costTotalCents / 100)
                  : "--"}
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/flights/${flight.id}`}>Details</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
