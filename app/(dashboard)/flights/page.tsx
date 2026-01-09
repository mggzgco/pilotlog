import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { createFlightAction } from "@/app/lib/actions/flight-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function FlightsPage() {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const flights = await prisma.flight.findMany({
    where: { userId: user.id },
    orderBy: { departAt: "desc" }
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
            <Input name="departAt" type="datetime-local" required />
            <Input name="arriveAt" type="datetime-local" />
            <Input name="durationMins" type="number" placeholder="Duration (mins)" />
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
          <div className="space-y-3">
            {flights.length === 0 && (
              <p className="text-sm text-slate-500">No flights yet.</p>
            )}
            {flights.map((flight) => (
              <div
                key={flight.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-4"
              >
                <div>
                  <p className="text-sm text-slate-400">{flight.tailNumber}</p>
                  <p className="text-lg font-semibold">
                    {flight.origin} → {flight.destination ?? "TBD"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {flight.departAt.toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/flights/${flight.id}`}>Details</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
