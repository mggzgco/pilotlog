import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { FlightMap } from "@/app/components/maps/flight-map";

export default async function FlightDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!flight) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Flight details</h2>
        <p className="text-sm text-slate-400">
          {flight.tailNumber} · {flight.origin} → {flight.destination ?? "TBD"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Route map</p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <FlightMap polyline={flight.routePolyline} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Statistics</p>
        </CardHeader>
        <CardContent>
          {/* FLIGHT-003: show flight stats summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-400">Duration</p>
              <p className="text-lg font-semibold">
                {flight.durationMinutes ?? "--"} mins
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Distance</p>
              <p className="text-lg font-semibold">
                {flight.distanceNm ?? "--"} nm
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Departure</p>
              <p className="text-lg font-semibold">
                {flight.startTime.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
