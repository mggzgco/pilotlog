import Link from "next/link";
import { requireUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FlightMap } from "@/app/components/maps/flight-map";
import { getLatestFlightWithTrackPoints, getRecentFlights } from "@/app/lib/flights/queries";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatFlightRouteLabel } from "@/app/lib/flights/route";
import { flightHasLandingOverDistanceNm } from "@/app/lib/airports/xc";
import { CostPieChart, type CostPieSlice } from "@/app/components/charts/CostPieChart";
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

  const [logbookMonth, logbook30, logbookYtd, monthCostItems, flights90, flights30, upcomingFlights] =
    await Promise.all([
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: monthStart } },
        select: {
          totalTime: true,
          picTime: true,
          dualReceivedTime: true,
          nightTime: true,
          instrumentTime: true,
          xcTime: true,
          dayTakeoffs: true,
          dayLandings: true,
          nightTakeoffs: true,
          nightLandings: true,
          flight: {
            select: {
              durationMinutes: true,
              originAirport: { select: { latitude: true, longitude: true } },
              destinationAirport: { select: { latitude: true, longitude: true } },
              stops: { select: { airport: { select: { latitude: true, longitude: true } } } }
            }
          }
        }
      }),
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: days30 } },
        select: {
          totalTime: true,
          picTime: true,
          dualReceivedTime: true,
          nightTime: true,
          instrumentTime: true,
          xcTime: true,
          dayTakeoffs: true,
          dayLandings: true,
          nightTakeoffs: true,
          nightLandings: true,
          flight: {
            select: {
              durationMinutes: true,
              originAirport: { select: { latitude: true, longitude: true } },
              destinationAirport: { select: { latitude: true, longitude: true } },
              stops: { select: { airport: { select: { latitude: true, longitude: true } } } }
            }
          }
        }
      }),
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: yearStart } },
        select: {
          totalTime: true,
          picTime: true,
          dualReceivedTime: true,
          nightTime: true,
          instrumentTime: true,
          xcTime: true,
          dayTakeoffs: true,
          dayLandings: true,
          nightTakeoffs: true,
          nightLandings: true,
          flight: {
            select: {
              durationMinutes: true,
              originAirport: { select: { latitude: true, longitude: true } },
              destinationAirport: { select: { latitude: true, longitude: true } },
              stops: { select: { airport: { select: { latitude: true, longitude: true } } } }
            }
          }
        }
      }),
      prisma.costItem.findMany({
        where: { userId: user.id, date: { gte: monthStart } },
        select: {
          id: true,
          amountCents: true,
          category: true,
          flightId: true,
          flight: {
            select: {
              id: true,
              origin: true,
              destination: true,
              stops: { orderBy: { order: "asc" }, select: { label: true } },
              tailNumber: true,
              tailNumberSnapshot: true
            }
          }
        }
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
      dualReceivedTime: unknown;
      nightTime: unknown;
      instrumentTime: unknown;
      xcTime: unknown;
      dayTakeoffs: unknown;
      dayLandings: unknown;
      nightTakeoffs: unknown;
      nightLandings: unknown;
      flight:
        | {
            durationMinutes: number | null;
            originAirport: { latitude: number | null; longitude: number | null } | null;
            destinationAirport: { latitude: number | null; longitude: number | null } | null;
            stops: Array<{
              airport: { latitude: number | null; longitude: number | null } | null;
            }>;
          }
        | null;
    }>
  ) => {
    const totals = {
      total: 0,
      dual: 0,
      pic: 0,
      night: 0,
      instrument: 0,
      xc: 0,
      takeoffs: 0,
      landings: 0,
      entries: 0
    };
    for (const entry of entries) {
      totals.entries += 1;
      const totalRaw = Number(entry.totalTime);
      const total =
        Number.isFinite(totalRaw) && totalRaw > 0
          ? totalRaw
          : (entry.flight?.durationMinutes ?? 0) / 60;
      totals.total += total;
      totals.dual += Number(entry.dualReceivedTime) || 0;
      totals.pic += Number(entry.picTime) || 0;
      totals.night += Number(entry.nightTime) || 0;
      totals.instrument += Number(entry.instrumentTime) || 0;
      const explicitXc = Number(entry.xcTime) || 0;
      if (explicitXc > 0) {
        totals.xc += explicitXc;
      } else if (entry.flight && flightHasLandingOverDistanceNm(entry.flight, 50)) {
        totals.xc += total;
      }
      totals.takeoffs += (Number(entry.dayTakeoffs) || 0) + (Number(entry.nightTakeoffs) || 0);
      totals.landings += (Number(entry.dayLandings) || 0) + (Number(entry.nightLandings) || 0);
    }
    return totals;
  };

  const totalsMonth = computeLogbookTotals(logbookMonth);
  const totals30 = computeLogbookTotals(logbook30);
  const totalsYtd = computeLogbookTotals(logbookYtd);
  const monthCostCents = monthCostItems.reduce((sum, item) => sum + item.amountCents, 0);

  const monthCostPerHour =
    totalsMonth.total > 0 ? monthCostCents / totalsMonth.total : null;

  const monthCostByCategory = monthCostItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.amountCents;
    return acc;
  }, {});

  const categoryPalette = [
    "#0ea5e9",
    "#6366f1",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#14b8a6"
  ];

  const categoryEntries = Object.entries(monthCostByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const otherCents = Object.entries(monthCostByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(6)
    .reduce((sum, [, cents]) => sum + cents, 0);

  const spendSlices: CostPieSlice[] = [
    ...categoryEntries.map(([category, cents], idx) => ({
      label: category.replaceAll("_", " "),
      valueCents: cents,
      color: categoryPalette[idx % categoryPalette.length]
    })),
    ...(otherCents > 0
      ? [{ label: "Other", valueCents: otherCents, color: "#64748b" }]
      : [])
  ];

  const costByFlightId = monthCostItems.reduce<Record<string, number>>((acc, item) => {
    if (!item.flightId) return acc;
    acc[item.flightId] = (acc[item.flightId] ?? 0) + item.amountCents;
    return acc;
  }, {});
  const mostExpensiveFlightId = Object.entries(costByFlightId).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostExpensiveFlightCostCents = mostExpensiveFlightId ? costByFlightId[mostExpensiveFlightId] : null;
  const mostExpensiveFlight = mostExpensiveFlightId
    ? monthCostItems.find((item) => item.flightId === mostExpensiveFlightId)?.flight ?? null
    : null;

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
                  {(() => {
                    const buckets = [
                      { key: "dual", label: "Dual", value: row.totals.dual, color: "bg-sky-500" },
                      { key: "pic", label: "PIC", value: row.totals.pic, color: "bg-indigo-500" },
                      { key: "ifr", label: "IFR", value: row.totals.instrument, color: "bg-violet-500" },
                      { key: "night", label: "Night", value: row.totals.night, color: "bg-slate-600" },
                      { key: "xc", label: "XC", value: row.totals.xc, color: "bg-emerald-500" }
                    ];
                    const total = row.totals.total;
                    const nonZero = buckets.filter((b) => b.value >= 0.05).sort((a, b) => b.value - a.value);
                    const top = nonZero[0] ?? null;
                    const focusLabel =
                      top && total > 0
                        ? `${top.label} focus · ${Math.round((top.value / total) * 100)}%`
                        : "No time breakdown yet";

                    const display = (nonZero.length > 0 ? nonZero : buckets).slice(0, 4);

                    return (
                      <div className="mt-3 space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                            Mix
                          </p>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            {total > 0
                              ? display.map((b) => (
                                  <div
                                    key={b.key}
                                    className={`h-2 ${b.color} inline-block`}
                                    style={{ width: `${Math.max(2, (b.value / total) * 100)}%` }}
                                  />
                                ))
                              : null}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{focusLabel}</p>
                        </div>

                        <div className="grid gap-2 text-sm">
                          {display.map((bucket) => (
                            <div
                              key={bucket.key}
                              className="flex items-center justify-between text-slate-700 dark:text-slate-200"
                            >
                              <span className="text-slate-600 dark:text-slate-400">
                                {bucket.label === "XC" ? "XC (landing ≥50nm)" : bucket.label}
                              </span>
                              <span>{bucket.value.toFixed(1)}h</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                            <span className="text-slate-600 dark:text-slate-400">Landings</span>
                            <span>{row.totals.landings || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                            <span className="text-slate-600 dark:text-slate-400">Avg / entry</span>
                            <span>
                              {row.totals.entries > 0 ? `${(row.totals.total / row.totals.entries).toFixed(1)}h` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  This month
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {formatMoney(monthCostCents)}
                </p>
                <p className="text-xs text-slate-500">
                  {monthCostPerHour !== null
                    ? `${formatMoney(Math.round(monthCostPerHour))} / flight hour`
                    : "Cost per hour available after logging hours"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Wallet className="h-4 w-4" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Breakdown
                </p>
                <CostPieChart slices={spendSlices} />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Highlights
                </p>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Most expensive flight (month)
                  </p>
                  {mostExpensiveFlight && mostExpensiveFlightCostCents !== null ? (
                    <Link
                      href={`/flights/${mostExpensiveFlight.id}`}
                      className="mt-2 block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {formatFlightRouteLabel({
                              origin: mostExpensiveFlight.origin,
                              stops: mostExpensiveFlight.stops ?? [],
                              destination: mostExpensiveFlight.destination ?? "TBD"
                            })}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {(mostExpensiveFlight.tailNumberSnapshot ?? mostExpensiveFlight.tailNumber) || "—"}
                          </p>
                        </div>
                        <div className="shrink-0 font-semibold">
                          {formatMoney(mostExpensiveFlightCostCents)}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      No flight-linked costs yet this month.
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  {spendSlices
                    .slice()
                    .sort((a, b) => b.valueCents - a.valueCents)
                    .slice(0, 5)
                    .map((slice) => (
                      <div
                        key={slice.label}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/30"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="text-slate-700 dark:text-slate-200">
                            {slice.label}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(slice.valueCents)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/costs">Open costs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">Open reports</Link>
            </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
