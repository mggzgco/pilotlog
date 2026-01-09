import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FlightMap } from "@/app/components/maps/flight-map";

export default async function DashboardPage() {
  const user = await requireUser();

  const [flightCount, costTotal, logbookTotal, latestFlight, recentFlights] = await Promise.all([
    prisma.flight.count({ where: { userId: user.id } }),
    prisma.costItem.aggregate({
      where: { userId: user.id },
      _sum: { amount: true }
    }),
    prisma.logbookEntry.aggregate({
      where: { userId: user.id },
      _sum: { totalTime: true }
    }),
    prisma.flight.findFirst({
      where: { userId: user.id },
      orderBy: { startTime: "desc" }
    }),
    prisma.flight.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "desc" },
      take: 3
    })
  ]);

  // DASH-001: unified operational summary for the pilot
  return (
    <div className="space-y-6">
      {/* DASH-002: primary actions for flight tracking */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Review flight activity, logbook totals, and costs at a glance.
          </p>
        </div>
        <Button asChild>
          <Link href="/import">Import ADS-B flight</Link>
        </Button>
      </div>

      {/* DASH-003: high-level stats for hours and costs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Flights tracked</p>
            <p className="text-2xl font-semibold">{flightCount}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Total hours logged</p>
            <p className="text-2xl font-semibold">
              {Number(logbookTotal._sum.totalTime ?? 0).toFixed(1)} hrs
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Total training spend</p>
            <p className="text-2xl font-semibold">
              ${Number(costTotal._sum.amount ?? 0).toFixed(2)}
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* DASH-004: map-based latest flight visualization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Latest flight path</p>
              <p className="text-lg font-semibold">
                {latestFlight
                  ? `${latestFlight.origin} → ${latestFlight.destination ?? "TBD"}`
                  : "No flights yet"}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/flights">View flights</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <FlightMap polyline={latestFlight?.routePolyline} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Recent flights</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tail</th>
                  <th className="px-4 py-3 text-left font-medium">Route</th>
                  <th className="px-4 py-3 text-left font-medium">Start</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentFlights.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                      No flights logged yet.
                    </td>
                  </tr>
                ) : (
                  recentFlights.map((flight) => (
                    <tr key={flight.id} className="text-slate-200">
                      <td className="px-4 py-3">{flight.tailNumber}</td>
                      <td className="px-4 py-3">
                        {flight.origin} → {flight.destination ?? "TBD"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {flight.startTime.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
