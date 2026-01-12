import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

const formatRoute = (origin?: string | null, destination?: string | null) => {
  if (!origin && !destination) return "—";
  if (!destination) return origin ?? "—";
  return `${origin ?? "—"} → ${destination}`;
};

const toHours = (value: number | string | { toString(): string } | null | undefined) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatHours = (value: number | string | { toString(): string } | null | undefined) => {
  const numeric = toHours(value);
  return numeric === null ? "—" : numeric.toFixed(1);
};

export default async function LogbookEntryDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { user } = await getCurrentSession();
  if (!user) return null;

  const entry = await prisma.logbookEntry.findFirst({
    where: { id: params.id, userId: user.id },
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

  if (!entry) {
    notFound();
  }

  const flights = await prisma.flight.findMany({
    where: { userId: user.id },
    orderBy: { startTime: "desc" },
    select: {
      id: true,
      origin: true,
      destination: true,
      startTime: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      aircraft: { select: { tailNumber: true, model: true } }
    }
  });

  const linkedFlight = entry.flight;
  const tailNumber =
    linkedFlight?.tailNumberSnapshot ||
    linkedFlight?.aircraft?.tailNumber ||
    linkedFlight?.tailNumber ||
    entry.tailNumberSnapshot ||
    "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/logbook">← Back</Link>
            </Button>
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Logbook entry</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {entry.date.toLocaleDateString()} · {tailNumber} ·{" "}
            {formatRoute(linkedFlight?.origin ?? entry.origin, linkedFlight?.destination ?? entry.destination)}
          </p>
          {linkedFlight ? (
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/flights/${linkedFlight.id}`}>View linked flight</Link>
              </Button>
            </div>
          ) : null}
        </div>

        <Card className="w-full sm:w-auto">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatHours(entry.totalTime)} hrs
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">PIC</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatHours(entry.picTime)} hrs
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Night</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatHours(entry.nightTime)} hrs
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Instrument</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatHours(entry.instrumentTime)} hrs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Details</p>
        </CardHeader>
        <CardContent>
          <form action="/api/logbook/create" method="post" className="grid gap-3 lg:grid-cols-3">
            <input type="hidden" name="id" value={entry.id} />
            <select
              name="status"
              defaultValue={entry.status}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
            >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              name="flightId"
              defaultValue={entry.flightId ?? ""}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
            >
              <option value="">Link a flight (optional)</option>
              {flights.map((flight) => {
                const tn = flight.tailNumberSnapshot || flight.aircraft?.tailNumber || flight.tailNumber;
                const label = `${tn} · ${formatRoute(flight.origin, flight.destination)} · ${flight.startTime
                  .toISOString()
                  .slice(0, 10)}`;
                return (
                  <option key={flight.id} value={flight.id}>
                    {label}
                  </option>
                );
              })}
            </select>

            <Input
              name="date"
              type="date"
              required
              defaultValue={entry.date.toISOString().slice(0, 10)}
            />
            <Input
              name="timeOut"
              type="text"
              inputMode="text"
              placeholder="Time out (HH:MM or HHMM)"
              pattern="^([01]\\d|2[0-3]):?[0-5]\\d$"
              defaultValue={entry.timeOut ?? ""}
            />
            <Input
              name="timeIn"
              type="text"
              inputMode="text"
              placeholder="Time in (HH:MM or HHMM)"
              pattern="^([01]\\d|2[0-3]):?[0-5]\\d$"
              defaultValue={entry.timeIn ?? ""}
            />
            <Input
              name="hobbsOut"
              type="number"
              step="0.1"
              placeholder="Hobbs out"
              defaultValue={entry.hobbsOut?.toString?.() ?? ""}
            />
            <Input
              name="hobbsIn"
              type="number"
              step="0.1"
              placeholder="Hobbs in"
              defaultValue={entry.hobbsIn?.toString?.() ?? ""}
            />

            <div className="lg:col-span-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Total time is computed when you save (Hobbs or Time In/Out preferred; otherwise time buckets).
              </p>
            </div>

            <Input
              name="picTime"
              type="number"
              step="0.1"
              placeholder="PIC"
              defaultValue={entry.picTime?.toString?.() ?? ""}
            />
            <Input
              name="dualReceivedTime"
              type="number"
              step="0.1"
              placeholder="Dual rcvd"
              defaultValue={entry.dualReceivedTime?.toString?.() ?? ""}
            />
            <Input
              name="sicTime"
              type="number"
              step="0.1"
              placeholder="SIC"
              defaultValue={entry.sicTime?.toString?.() ?? ""}
            />
            <Input
              name="soloTime"
              type="number"
              step="0.1"
              placeholder="Solo"
              defaultValue={entry.soloTime?.toString?.() ?? ""}
            />
            <Input
              name="nightTime"
              type="number"
              step="0.1"
              placeholder="Night"
              defaultValue={entry.nightTime?.toString?.() ?? ""}
            />
            <Input
              name="xcTime"
              type="number"
              step="0.1"
              placeholder="XC"
              defaultValue={entry.xcTime?.toString?.() ?? ""}
            />
            <Input
              name="simulatedInstrumentTime"
              type="number"
              step="0.1"
              placeholder="Sim inst"
              defaultValue={entry.simulatedInstrumentTime?.toString?.() ?? ""}
            />
            <Input
              name="instrumentTime"
              type="number"
              step="0.1"
              placeholder="Actual inst"
              defaultValue={entry.instrumentTime?.toString?.() ?? ""}
            />
            <Input
              name="simulatorTime"
              type="number"
              step="0.1"
              placeholder="Simulator"
              defaultValue={entry.simulatorTime?.toString?.() ?? ""}
            />
            <Input
              name="groundTime"
              type="number"
              step="0.1"
              placeholder="Ground"
              defaultValue={entry.groundTime?.toString?.() ?? ""}
            />
            <Input
              name="dayTakeoffs"
              type="number"
              step="1"
              placeholder="Day T/O"
              defaultValue={entry.dayTakeoffs ?? ""}
            />
            <Input
              name="dayLandings"
              type="number"
              step="1"
              placeholder="Day LDG"
              defaultValue={entry.dayLandings ?? ""}
            />
            <Input
              name="nightTakeoffs"
              type="number"
              step="1"
              placeholder="Night T/O"
              defaultValue={entry.nightTakeoffs ?? ""}
            />
            <Input
              name="nightLandings"
              type="number"
              step="1"
              placeholder="Night LDG"
              defaultValue={entry.nightLandings ?? ""}
            />
            <Input
              name="remarks"
              placeholder="Remarks"
              className="lg:col-span-3"
              defaultValue={entry.remarks ?? ""}
            />

            <div className="lg:col-span-3 flex flex-wrap gap-2">
              <Button type="submit">Save changes</Button>
              <Button asChild variant="outline">
                <Link href="/logbook">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

