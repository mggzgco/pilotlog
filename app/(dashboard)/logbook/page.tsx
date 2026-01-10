import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createLogbookEntryAction } from "@/app/lib/actions/logbook-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

const metrics = [
  { key: "totalTime", label: "Total" },
  { key: "picTime", label: "PIC" },
  { key: "sicTime", label: "SIC" },
  { key: "nightTime", label: "Night" },
  { key: "instrumentTime", label: "Instrument" }
] as const;

type MetricKey = (typeof metrics)[number]["key"];

type LogbookSearchParams = {
  startDate?: string;
  endDate?: string;
  aircraft?: string;
  search?: string;
  flightId?: string;
  metrics?: string | string[];
};

const toHours = (value: number | string | { toString(): string } | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatHours = (value: number | string | { toString(): string } | null | undefined) => {
  const numeric = toHours(value);
  return numeric === null ? "—" : numeric.toFixed(1);
};

const parseMetrics = (value: LogbookSearchParams["metrics"]) => {
  const defaultMetrics = metrics.map((metric) => metric.key);
  if (!value) {
    return defaultMetrics;
  }
  const raw = Array.isArray(value)
    ? value
    : value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const filtered = raw.filter((entry): entry is MetricKey =>
    metrics.some((metric) => metric.key === entry)
  );
  return filtered.length > 0 ? filtered : defaultMetrics;
};

const formatRoute = (origin?: string | null, destination?: string | null) => {
  if (!origin && !destination) {
    return "—";
  }
  if (!destination) {
    return origin ?? "—";
  }
  return `${origin ?? "—"} → ${destination}`;
};

export default async function LogbookPage({
  searchParams
}: {
  searchParams?: LogbookSearchParams;
}) {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const selectedMetrics = parseMetrics(searchParams?.metrics);
  const startDate = searchParams?.startDate?.trim() || "";
  const endDate = searchParams?.endDate?.trim() || "";
  const aircraftFilter = searchParams?.aircraft?.trim() || "";
  const searchFilter = searchParams?.search?.trim() || "";
  const flightIdFilter = searchParams?.flightId?.trim() || "";

  const flights = await prisma.flight.findMany({
    where: { userId: user.id },
    orderBy: { startTime: "desc" },
    select: {
      id: true,
      origin: true,
      destination: true,
      startTime: true,
      durationMinutes: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      status: true,
      importedProvider: true,
      providerFlightId: true,
      aircraft: { select: { tailNumber: true, model: true } }
    }
  });

  const selectedFlight = flightIdFilter
    ? await prisma.flight.findFirst({
        where: { id: flightIdFilter, userId: user.id },
        select: {
          id: true,
          origin: true,
          destination: true,
          startTime: true,
          durationMinutes: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          status: true,
          importedProvider: true,
          providerFlightId: true,
          aircraft: { select: { tailNumber: true, model: true } },
          participants: {
            include: { user: true },
            orderBy: { createdAt: "asc" }
          },
          peopleParticipants: {
            include: { person: true },
            orderBy: { createdAt: "asc" }
          }
        }
      })
    : null;

  const aircraftOptions = Array.from(
    new Set(
      flights
        .map(
          (flight) =>
            flight.tailNumberSnapshot ||
            flight.aircraft?.tailNumber ||
            flight.tailNumber
        )
        .filter(Boolean)
    )
  ).sort();

  const entryFilters: Prisma.LogbookEntryWhereInput = {
    userId: user.id
  };
  const andFilters: Prisma.LogbookEntryWhereInput[] = [];

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    andFilters.push({ date: dateFilter });
  }

  if (aircraftFilter) {
    andFilters.push({
      flight: {
        is: {
          OR: [
            { tailNumberSnapshot: aircraftFilter },
            { tailNumber: aircraftFilter },
            { aircraft: { tailNumber: aircraftFilter } }
          ]
        }
      }
    });
  }

  if (searchFilter) {
    andFilters.push({
      OR: [
        { remarks: { contains: searchFilter, mode: "insensitive" } },
        {
          flight: {
            is: {
              OR: [
                { origin: { contains: searchFilter, mode: "insensitive" } },
                { destination: { contains: searchFilter, mode: "insensitive" } },
                { tailNumberSnapshot: { contains: searchFilter, mode: "insensitive" } },
                { tailNumber: { contains: searchFilter, mode: "insensitive" } },
                {
                  aircraft: {
                    tailNumber: { contains: searchFilter, mode: "insensitive" }
                  }
                }
              ]
            }
          }
        }
      ]
    });
  }

  if (andFilters.length > 0) {
    entryFilters.AND = andFilters;
  }

  const entries = await prisma.logbookEntry.findMany({
    where: entryFilters,
    orderBy: { date: "desc" },
    include: {
      flight: {
        select: {
          id: true,
          origin: true,
          destination: true,
          startTime: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          aircraft: { select: { tailNumber: true, model: true } }
        }
      }
    }
  });

  const totals = entries.reduce(
    (acc, entry) => {
      acc.totalTime += toHours(entry.totalTime) ?? 0;
      acc.picTime += toHours(entry.picTime) ?? 0;
      acc.sicTime += toHours(entry.sicTime) ?? 0;
      acc.nightTime += toHours(entry.nightTime) ?? 0;
      acc.instrumentTime += toHours(entry.instrumentTime) ?? 0;
      return acc;
    },
    {
      totalTime: 0,
      picTime: 0,
      sicTime: 0,
      nightTime: 0,
      instrumentTime: 0
    }
  );

  const selectedFlightLabel = selectedFlight
    ? `${selectedFlight.tailNumberSnapshot ||
        selectedFlight.aircraft?.tailNumber ||
        selectedFlight.tailNumber} · ${formatRoute(
        selectedFlight.origin,
        selectedFlight.destination
      )}`
    : "";

  const selectedFlightCrew = selectedFlight
    ? [
        ...selectedFlight.participants.map((participant) => ({
          name:
            participant.user.name ||
            [participant.user.firstName, participant.user.lastName]
              .filter(Boolean)
              .join(" ") ||
            participant.user.email,
          role: participant.role
        })),
        ...selectedFlight.peopleParticipants.map((participant) => ({
          name: participant.person.name,
          role: participant.role
        }))
      ]
    : [];

  const isSelectedFlightImported = selectedFlight
    ? Boolean(
        selectedFlight.importedProvider ||
          selectedFlight.providerFlightId ||
          ["IMPORTED", "COMPLETED"].includes(selectedFlight.status)
      )
    : false;

  const prefillTotalTime =
    selectedFlight && isSelectedFlightImported && selectedFlight.durationMinutes !== null
      ? (selectedFlight.durationMinutes / 60).toFixed(1)
      : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Logbook</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Track PIC/SIC, night, and IFR time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Totals</p>
              <p className="text-xs text-slate-500">
                Based on {entries.length} matching entries
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {metrics
              .filter((metric) => selectedMetrics.includes(metric.key))
              .map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {metric.label}
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {formatHours(totals[metric.key])} hrs
                  </p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Filters</p>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 lg:grid-cols-4">
            <Input
              name="startDate"
              type="date"
              placeholder="Start date"
              defaultValue={startDate}
            />
            <Input
              name="endDate"
              type="date"
              placeholder="End date"
              defaultValue={endDate}
            />
            <select
              name="aircraft"
              defaultValue={aircraftFilter}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
            >
              <option value="">All aircraft</option>
              {aircraftOptions.map((tailNumber) => (
                <option key={tailNumber} value={tailNumber}>
                  {tailNumber}
                </option>
              ))}
            </select>
            <Input
              name="search"
              placeholder="Search remarks or route"
              defaultValue={searchFilter}
            />
            <div className="lg:col-span-4">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Summary metrics
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {metrics.map((metric) => (
                  <label
                    key={metric.key}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      name="metrics"
                      value={metric.key}
                      defaultChecked={selectedMetrics.includes(metric.key)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700"
                    />
                    {metric.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-wrap gap-2">
              <Button type="submit" variant="outline">
                Apply filters
              </Button>
              <Button asChild variant="ghost">
                <Link href="/logbook">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Add logbook entry</p>
        </CardHeader>
        <CardContent>
          <form action={createLogbookEntryAction} className="grid gap-3 lg:grid-cols-3">
            <select
              name="flightId"
              defaultValue={selectedFlight?.id ?? ""}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
            >
              <option value="">Link a flight (optional)</option>
              {flights.map((flight) => {
                const tailNumber =
                  flight.tailNumberSnapshot ||
                  flight.aircraft?.tailNumber ||
                  flight.tailNumber;
                const label = `${tailNumber} · ${formatRoute(
                  flight.origin,
                  flight.destination
                )} · ${flight.startTime.toISOString().slice(0, 10)}`;
                return (
                  <option key={flight.id} value={flight.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            {selectedFlight ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100 lg:col-span-3">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Selected flight
                </p>
                <p className="font-semibold">{selectedFlightLabel}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedFlight.startTime.toLocaleString()}
                </p>
                {selectedFlightCrew.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Crew: {selectedFlightCrew.map((crew) => `${crew.name} (${crew.role})`).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Input
              name="date"
              type="date"
              required
              defaultValue={
                selectedFlight
                  ? selectedFlight.startTime.toISOString().slice(0, 10)
                  : new Date().toISOString().slice(0, 10)
              }
            />
            <Input
              name="totalTime"
              placeholder="Total time"
              defaultValue={prefillTotalTime}
            />
            <Input name="picTime" placeholder="PIC time" />
            <Input name="sicTime" placeholder="SIC time" />
            <Input name="nightTime" placeholder="Night" />
            <Input name="instrumentTime" placeholder="Instrument" />
            <Input name="remarks" placeholder="Remarks" className="lg:col-span-2" />
            <div className="lg:col-span-3">
              <Button type="submit">Save entry</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Logbook entries</p>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No logbook entries yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <table className="min-w-full text-left text-sm text-slate-900 dark:text-slate-100">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Aircraft</th>
                    <th className="px-4 py-2">Route</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">PIC</th>
                    <th className="px-4 py-2">SIC</th>
                    <th className="px-4 py-2">Night</th>
                    <th className="px-4 py-2">Instrument</th>
                    <th className="px-4 py-2">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {entries.map((entry) => {
                    const flight = entry.flight;
                    const tailNumber =
                      flight?.tailNumberSnapshot ||
                      flight?.aircraft?.tailNumber ||
                      flight?.tailNumber ||
                      "—";
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="px-4 py-3">
                          {entry.date.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{tailNumber}</td>
                        <td className="px-4 py-3">
                          {formatRoute(flight?.origin, flight?.destination)}
                        </td>
                        <td className="px-4 py-3">{formatHours(entry.totalTime)}</td>
                        <td className="px-4 py-3">{formatHours(entry.picTime)}</td>
                        <td className="px-4 py-3">{formatHours(entry.sicTime)}</td>
                        <td className="px-4 py-3">{formatHours(entry.nightTime)}</td>
                        <td className="px-4 py-3">{formatHours(entry.instrumentTime)}</td>
                        <td className="px-4 py-3">
                          {flight ? (
                            <div className="flex flex-col gap-1">
                              <Link
                                href={`/flights/${flight.id}`}
                                className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                              >
                                View flight
                              </Link>
                              <Link
                                href={`/flights/${flight.id}#costs`}
                                className="text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                              >
                                View costs
                              </Link>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
