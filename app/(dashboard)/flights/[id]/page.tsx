import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { FlightMap } from "@/app/components/maps/flight-map";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AltitudeChart } from "@/app/components/charts/AltitudeChart";

export default async function FlightDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      logbookEntries: { orderBy: { date: "desc" } },
      costItems: { select: { amount: true } }
    }
  });

  if (!flight) {
    notFound();
  }

  const logbookEntry = flight.logbookEntries[0] ?? null;
  const altitudePoints = flight.trackPoints
    .filter((point) => point.altitudeFeet !== null)
    .map((point) => ({
      recordedAt: point.recordedAt.toISOString(),
      altitudeFeet: point.altitudeFeet as number
    }));
  const maxAltitude =
    altitudePoints.length > 0
      ? Math.max(...altitudePoints.map((point) => point.altitudeFeet))
      : null;
  const costTotal = flight.costItems.reduce(
    (total, item) => total + Number(item.amount),
    0
  );
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

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
            <FlightMap
              polyline={flight.routePolyline}
              track={flight.trackPoints ?? undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Statistics</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
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
            <div>
              <p className="text-xs uppercase text-slate-400">Max altitude</p>
              <p className="text-lg font-semibold">
                {maxAltitude ? `${maxAltitude.toLocaleString()} ft` : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Cost total</p>
              <p className="text-lg font-semibold">
                {costTotal > 0 ? currencyFormatter.format(costTotal) : "--"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {altitudePoints.length > 1 ? (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Altitude profile</p>
          </CardHeader>
          <CardContent>
            <AltitudeChart points={altitudePoints} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Logbook entry</p>
        </CardHeader>
        <CardContent>
          <form
            action={`/api/flights/${flight.id}/update-logbook`}
            method="post"
            className="grid gap-3 md:grid-cols-3"
          >
            <Input
              name="date"
              type="date"
              required
              defaultValue={
                logbookEntry?.date
                  ? logbookEntry.date.toISOString().slice(0, 10)
                  : flight.startTime.toISOString().slice(0, 10)
              }
            />
            <Input
              name="totalTime"
              type="number"
              step="0.1"
              placeholder="Total time"
              defaultValue={logbookEntry?.totalTime?.toString() ?? ""}
            />
            <Input
              name="picTime"
              type="number"
              step="0.1"
              placeholder="PIC time"
              defaultValue={logbookEntry?.picTime?.toString() ?? ""}
            />
            <Input
              name="sicTime"
              type="number"
              step="0.1"
              placeholder="SIC time"
              defaultValue={logbookEntry?.sicTime?.toString() ?? ""}
            />
            <Input
              name="nightTime"
              type="number"
              step="0.1"
              placeholder="Night time"
              defaultValue={logbookEntry?.nightTime?.toString() ?? ""}
            />
            <Input
              name="instrumentTime"
              type="number"
              step="0.1"
              placeholder="Instrument time"
              defaultValue={logbookEntry?.instrumentTime?.toString() ?? ""}
            />
            <div className="md:col-span-3">
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                Remarks
              </label>
              <textarea
                name="remarks"
                className="min-h-[120px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                placeholder="Logbook notes, tags, endorsements"
                defaultValue={logbookEntry?.remarks ?? ""}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Save logbook</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Costs & receipts</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Costs and receipt uploads will be added here soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
