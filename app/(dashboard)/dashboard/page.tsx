import Link from "next/link";
import { requireUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FlightMap } from "@/app/components/maps/flight-map";
import { getLatestFlightWithTrackPoints, getRecentFlights } from "@/app/lib/flights/queries";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatFlightRouteLabel } from "@/app/lib/flights/route";
import { ArrowRight, Calendar, Radar, TriangleAlert, Wallet } from "lucide-react";

function formatDuration(durationMinutes: number | null) {
  if (!durationMinutes) {
    return "—";
  }
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatMoney(cents: number) {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });
  return currencyFormatter.format(cents / 100);
}

export default async function DashboardPage() {
  const user = await requireUser();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const days90 = addDays(now, -90);
  const days30 = addDays(now, -30);
  const todayStart = startOfDay(now);
  const next7Start = todayStart;
  const next7End = addDays(todayStart, 7);
  const recentCompletedStart = addDays(todayStart, -14);

  const [latestFlight, recentFlights] = await Promise.all([
    getLatestFlightWithTrackPoints(user.id),
    getRecentFlights(user.id, 10)
  ]);

  const [logbookMonth, logbook30, logbookYtd, monthCosts, flights90, flights30, upcomingFlights] =
    await Promise.all([
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: monthStart } },
        select: {
          totalTime: true,
          picTime: true,
          nightTime: true,
          instrumentTime: true,
          flight: { select: { durationMinutes: true, distanceNm: true } }
        }
      }),
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: days30 } },
        select: {
          totalTime: true,
          picTime: true,
          nightTime: true,
          instrumentTime: true,
          flight: { select: { durationMinutes: true, distanceNm: true } }
        }
      }),
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: yearStart } },
        select: {
          totalTime: true,
          picTime: true,
          nightTime: true,
          instrumentTime: true,
          flight: { select: { durationMinutes: true, distanceNm: true } }
        }
      }),
      prisma.costItem.aggregate({
        where: { userId: user.id, date: { gte: monthStart } },
        _sum: { amountCents: true }
      }),
      prisma.flight.count({
        where: { userId: user.id, startTime: { gte: days90 } }
      }),
      prisma.flight.count({
        where: { userId: user.id, startTime: { gte: days30 } }
      }),
      prisma.flight.findMany({
        where: {
          userId: user.id,
          status: { in: ["PLANNED", "PREFLIGHT_SIGNED", "POSTFLIGHT_IN_PROGRESS"] },
          OR: [
            { plannedStartTime: { gte: now } },
            { plannedStartTime: null, startTime: { gte: now } }
          ]
        },
        orderBy: [{ plannedStartTime: "asc" }, { startTime: "asc" }],
        take: 5,
        select: {
          id: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          origin: true,
          destination: true,
          stops: { orderBy: { order: "asc" }, select: { label: true } },
          plannedStartTime: true,
          startTime: true,
          status: true
        }
      })
    ]);

  const computeLogbookTotals = (
    entries: Array<{
      totalTime: unknown;
      picTime: unknown;
      nightTime: unknown;
      instrumentTime: unknown;
      flight: { durationMinutes: number | null; distanceNm: number | null } | null;
    }>
  ) => {
    const totals = {
      total: 0,
      pic: 0,
      night: 0,
      instrument: 0,
      xc: 0
    };
    for (const entry of entries) {
      const totalRaw = Number(entry.totalTime);
      const total =
        Number.isFinite(totalRaw) && totalRaw > 0
          ? totalRaw
          : (entry.flight?.durationMinutes ?? 0) / 60;
      totals.total += total;
      totals.pic += Number(entry.picTime) || 0;
      totals.night += Number(entry.nightTime) || 0;
      totals.instrument += Number(entry.instrumentTime) || 0;
      const nm = entry.flight?.distanceNm ?? null;
      if (nm !== null && nm >= 50) {
        totals.xc += total;
      }
    }
    return totals;
  };

  const totalsMonth = computeLogbookTotals(logbookMonth);
  const totals30 = computeLogbookTotals(logbook30);
  const totalsYtd = computeLogbookTotals(logbookYtd);
  const monthCostCents = monthCosts._sum.amountCents ?? 0;

  const [plannerFlights, needsLogbookFlights, needsAdsbFlights, needsPostflightFlights] =
    await Promise.all([
      prisma.flight.findMany({
        where: {
          userId: user.id,
          OR: [
            { plannedStartTime: { gte: next7Start, lt: next7End } },
            { plannedStartTime: null, startTime: { gte: next7Start, lt: next7End } }
          ]
        },
        orderBy: [{ plannedStartTime: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          origin: true,
          destination: true,
          stops: { orderBy: { order: "asc" }, select: { label: true } },
          plannedStartTime: true,
          startTime: true,
          status: true,
          importedProvider: true
        }
      }),
      prisma.flight.findMany({
        where: {
          userId: user.id,
          startTime: { gte: recentCompletedStart, lt: now },
          logbookEntries: { none: {} }
        },
        orderBy: { startTime: "desc" },
        take: 5,
        select: {
          id: true,
          origin: true,
          destination: true,
          stops: { orderBy: { order: "asc" }, select: { label: true } },
          startTime: true,
          tailNumber: true,
          tailNumberSnapshot: true
        }
      }),
      prisma.flight.findMany({
        where: {
          userId: user.id,
          startTime: { gte: recentCompletedStart, lt: now },
          importedProvider: null
        },
        orderBy: { startTime: "desc" },
        take: 5,
        select: {
          id: true,
          origin: true,
          destination: true,
          stops: { orderBy: { order: "asc" }, select: { label: true } },
          startTime: true,
          tailNumber: true,
          tailNumberSnapshot: true
        }
      }),
      prisma.flight.findMany({
        where: {
          userId: user.id,
          startTime: { lt: now },
          status: { in: ["PREFLIGHT_SIGNED", "POSTFLIGHT_IN_PROGRESS"] }
        },
        orderBy: { startTime: "desc" },
        take: 5,
        select: {
          id: true,
          origin: true,
          destination: true,
          startTime: true,
          tailNumber: true,
          tailNumberSnapshot: true,
          status: true
        }
      })
    ]);

  const plannerByDay = new Map<string, typeof plannerFlights>();
  for (const flight of plannerFlights) {
    const when = flight.plannedStartTime ?? flight.startTime;
    const dayKey = startOfDay(when).toISOString();
    const existing = plannerByDay.get(dayKey) ?? [];
    existing.push(flight);
    plannerByDay.set(dayKey, existing);
  }
  const plannerDays = Array.from(plannerByDay.keys()).sort();

  if (recentFlights.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your pilot overview—hours, spend, recent activity, and what’s next.
            </p>
          </div>
          <Button asChild>
            <Link href="/import">Import ADS-B flight</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={<Radar className="h-6 w-6" />}
              title="No flights yet"
              description="Import a flight to see your latest route and keep track of recent activity."
              action={
                <Button asChild>
                  <Link href="/import">Import your first flight</Link>
                </Button>
              }
              secondaryAction={
                <Button variant="outline" asChild>
                  <Link href="/flights/new">Add a manual flight</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Clean pilot overview—hours, currency, spend, recent flights.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button asChild>
            <Link href="/import">Import ADS-B</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/flights">Open flights</Link>
        </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  This month
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {totalsMonth.total.toFixed(1)}h
                </p>
                <p className="text-xs text-slate-500">Flight time logged</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Last 30 days
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {totals30.total.toFixed(1)}h
                </p>
                <p className="text-xs text-slate-500">Rolling flight time</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Year to date
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalsYtd.total.toFixed(1)}h
            </p>
            <p className="text-xs text-slate-500">Total time logged</p>
          </CardContent>
        </Card>
      <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Currency proxy
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{flights90}</p>
            <p className="text-xs text-slate-500">Flights in last 90 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
            <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Most recent flight</p>
              <p className="text-lg font-semibold">
                {latestFlight
                  ? formatFlightRouteLabel({
                      origin: latestFlight.origin,
                      stops: latestFlight.stops ?? [],
                      destination: latestFlight.destination ?? "TBD"
                    })
                    : "—"}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/flights">View all flights</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <FlightMap
              polyline={latestFlight?.routePolyline}
              track={latestFlight?.trackPoints ?? undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <p className="text-sm text-slate-600 dark:text-slate-400">Today · next 7 days</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {plannerDays.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                No flights planned in the next 7 days.
              </div>
            ) : (
              <div className="space-y-3">
                {plannerDays.map((dayKey) => {
                  const day = new Date(dayKey);
                  const flights = plannerByDay.get(dayKey) ?? [];
                  return (
                    <div key={dayKey} className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        {formatDayLabel(day)}
                      </p>
                      <div className="space-y-2">
                        {flights.map((flight) => {
                          const when = (flight.plannedStartTime ?? flight.startTime).toLocaleTimeString(
                            undefined,
                            { hour: "numeric", minute: "2-digit" }
                          );
                          const tail = flight.tailNumberSnapshot ?? flight.tailNumber;
                          const hasAdsb = Boolean(flight.importedProvider);
                          return (
                            <Link
                              key={flight.id}
                              href={`/flights/${flight.id}`}
                              className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {formatFlightRouteLabel({
                                      origin: flight.origin,
                                      stops: flight.stops ?? [],
                                      destination: flight.destination ?? "TBD"
                                    })}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {when} · {tail} · {flight.status.replaceAll("_", " ").toLowerCase()}
                                    {hasAdsb ? " · ADS‑B" : ""}
                                  </p>
                                </div>
                                <ArrowRight className="mt-0.5 h-4 w-4 text-slate-400" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/flights/new">Plan a flight</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="text-sm text-slate-600 dark:text-slate-400">Time details</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "30 days", totals: totals30 },
                { label: "This month", totals: totalsMonth },
                { label: "YTD", totals: totalsYtd }
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {row.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {row.totals.total.toFixed(1)}h
                  </p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                      <span className="text-slate-600 dark:text-slate-400">PIC</span>
                      <span>{row.totals.pic.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                      <span className="text-slate-600 dark:text-slate-400">IFR</span>
                      <span>{row.totals.instrument.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                      <span className="text-slate-600 dark:text-slate-400">Night</span>
                      <span>{row.totals.night.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                      <span className="text-slate-600 dark:text-slate-400">XC (≥50nm)</span>
                      <span>{row.totals.xc.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-600 dark:text-slate-400">Needs attention</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Last 14 days
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    Keep your records complete and searchable.
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                  <TriangleAlert className="h-4 w-4" />
                </div>
              </div>
            </div>

            {needsLogbookFlights.length === 0 &&
            needsAdsbFlights.length === 0 &&
            needsPostflightFlights.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                You’re all caught up.
              </div>
            ) : (
              <div className="space-y-2">
                {needsLogbookFlights.slice(0, 3).map((flight) => (
                  <Link
                    key={`logbook-${flight.id}`}
                    href={`/flights/${flight.id}/logbook`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Add logbook
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {flight.origin} → {flight.destination ?? "TBD"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(flight.tailNumberSnapshot ?? flight.tailNumber)} ·{" "}
                      {flight.startTime.toLocaleDateString()}
                    </p>
                  </Link>
                ))}
                {needsAdsbFlights.slice(0, 3).map((flight) => (
                  <Link
                    key={`adsb-${flight.id}`}
                    href={`/flights/${flight.id}/match`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Attach ADS‑B
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {flight.origin} → {flight.destination ?? "TBD"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(flight.tailNumberSnapshot ?? flight.tailNumber)} ·{" "}
                      {flight.startTime.toLocaleDateString()}
                    </p>
                  </Link>
                ))}
                {needsPostflightFlights.slice(0, 2).map((flight) => (
                  <Link
                    key={`postflight-${flight.id}`}
                    href={`/flights/${flight.id}/checklists`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Finish postflight
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {flight.origin} → {flight.destination ?? "TBD"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(flight.tailNumberSnapshot ?? flight.tailNumber)} ·{" "}
                      {flight.startTime.toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/reports">View reports</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Recent flights</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
                {recentFlights.map((flight) => (
              <Link
                key={flight.id}
                href={`/flights/${flight.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {flight.origin} → {flight.destination ?? "TBD"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {(flight.startTime ?? new Date()).toLocaleString()} · {flight.tailNumber}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <span>{formatDuration(flight.durationMinutes)}</span>
                  <span>{flight.distanceNm ? `${flight.distanceNm} nm` : "—"}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Spend (secondary)</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                This month
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatMoney(monthCostCents)}
              </p>
              <p className="text-xs text-slate-500">Total costs logged</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/costs">Open costs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">Open reports</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
