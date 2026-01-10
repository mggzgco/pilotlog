import Link from "next/link";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FlightMap } from "@/app/components/maps/flight-map";
import { getLatestFlightWithTrackPoints, getRecentFlights } from "@/app/lib/flights/queries";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Radar } from "lucide-react";

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

export default async function DashboardPage() {
  const user = await requireUser();

  const [latestFlight, recentFlights] = await Promise.all([
    getLatestFlightWithTrackPoints(user.id),
    getRecentFlights(user.id, 10)
  ]);

  if (recentFlights.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            <p className="text-sm text-slate-400">
              Track flights from your imports and see the latest activity at a glance.
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
          <p className="text-sm text-slate-400">
            Review the most recent flight and a snapshot of your latest activity.
          </p>
        </div>
        <Button asChild>
          <Link href="/import">Import ADS-B flight</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-400">Most recent flight</p>
              <p className="text-lg font-semibold">
                {latestFlight
                  ? `${latestFlight.origin} → ${latestFlight.destination ?? "TBD"}`
                  : "No flights yet"}
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
          <p className="text-sm text-slate-400">Last 10 flights</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Start</th>
                  <th className="px-4 py-3 text-left font-medium">End</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-left font-medium">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentFlights.map((flight) => (
                  <tr key={flight.id} className="text-slate-200">
                    <td className="px-4 py-3">{flight.origin}</td>
                    <td className="px-4 py-3">{flight.destination ?? "TBD"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDuration(flight.durationMinutes)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {flight.distanceNm ? `${flight.distanceNm} nm` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
