import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FlightMap } from "@/app/components/maps/flight-map";
import { getLatestFlightWithTrackPoints, getRecentFlights } from "@/app/lib/flights/queries";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ArrowRight, Calendar, Radar, Wallet } from "lucide-react";

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

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
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
  const days90 = addDays(now, -90);
  const days30 = addDays(now, -30);

  const [latestFlight, recentFlights] = await Promise.all([
    getLatestFlightWithTrackPoints(user.id),
    getRecentFlights(user.id, 10)
  ]);

  const [monthLogbook, monthCosts, flights90, flights30, upcomingFlights] =
    await Promise.all([
      prisma.logbookEntry.findMany({
        where: { userId: user.id, date: { gte: monthStart } },
        select: { totalTime: true, flight: { select: { durationMinutes: true } } }
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
          plannedStartTime: true,
          startTime: true,
          status: true
        }
      })
    ]);

  const monthHours = monthLogbook.reduce((sum, entry) => {
    const total = Number(entry.totalTime);
    if (Number.isFinite(total) && total > 0) {
      return sum + total;
    }
    const minutes = entry.flight?.durationMinutes ?? 0;
    return sum + minutes / 60;
  }, 0);
  const monthCostCents = monthCosts._sum.amountCents ?? 0;

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
                  <Link href="/flights">Add a manual flight</Link>
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
                  {monthHours.toFixed(1)}h
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
                  Spend (month)
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {formatMoney(monthCostCents)}
                </p>
                <p className="text-xs text-slate-500">Training costs</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
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
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Recent activity
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{flights30}</p>
            <p className="text-xs text-slate-500">Flights in last 30 days</p>
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
                    ? `${latestFlight.origin} → ${latestFlight.destination ?? "TBD"}`
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
            <p className="text-sm text-slate-600 dark:text-slate-400">Up next</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingFlights.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                No upcoming flights scheduled.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingFlights.map((flight) => {
                  const when = (flight.plannedStartTime ?? flight.startTime).toLocaleString();
                  const tail = flight.tailNumberSnapshot ?? flight.tailNumber;
                  return (
                    <Link
                      key={flight.id}
                      href={`/flights/${flight.id}`}
                      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {flight.origin} → {flight.destination ?? "TBD"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {tail} · {when}
                          </p>
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 text-slate-400" />
                      </div>
                    </Link>
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
    </div>
  );
}
