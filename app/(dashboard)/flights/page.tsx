import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { createFlightAction } from "@/app/lib/actions/flight-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function FlightsPage() {
  const user = await requireUser();

  const flights = await prisma.flight.findMany({
    where: { userId: user.id },
    orderBy: { startTime: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Flights</h2>
          <p className="text-sm text-slate-400">Track route, time, and status.</p>
        </div>
        <Button asChild>
          <Link href="/import">Import ADS-B</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Add manual flight</p>
        </CardHeader>
        <CardContent>
          <form action={createFlightAction} className="grid gap-3 md:grid-cols-3">
            <Input name="tailNumber" placeholder="Tail #" required />
            <Input name="origin" placeholder="Origin (ICAO)" required />
            <Input name="destination" placeholder="Destination (ICAO)" />
            <Input name="startTime" type="datetime-local" required />
            <Input name="endTime" type="datetime-local" />
            <Input name="durationMinutes" type="number" placeholder="Duration (mins)" />
            <div className="md:col-span-3">
              <Button type="submit">Save flight</Button>
            </div>
          </form>
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
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {flights.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                      No flights yet.
                    </td>
                  </tr>
                ) : (
                  flights.map((flight) => (
                    <tr key={flight.id} className="text-slate-200">
                      <td className="px-4 py-3">{flight.tailNumber}</td>
                      <td className="px-4 py-3">
                        {flight.origin} → {flight.destination ?? "TBD"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {flight.startTime.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/flights/${flight.id}`}>Details</Link>
                        </Button>
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
