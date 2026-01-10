import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { FlightMap } from "@/app/components/maps/flight-map";
import { Button } from "@/app/components/ui/button";
import { AltitudeChart } from "@/app/components/charts/AltitudeChart";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";

export default async function FlightDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      costItems: { select: { id: true, amountCents: true } },
      logbookEntries: { select: { id: true } },
      receiptDocuments: { select: { id: true } },
      participants: { select: { id: true }, orderBy: { createdAt: "asc" } },
      checklistRuns: { select: { id: true, phase: true, status: true, decision: true } }
    }
  });

  if (!flight) {
    notFound();
  }

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
  const costTotalCents = flight.costItems.reduce(
    (total, item) => total + item.amountCents,
    0
  );
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });
  const showAutoImportRunning = flight.autoImportStatus === "RUNNING";
  const showAutoImportSuccess = flight.autoImportStatus === "MATCHED";
  const showAutoImportMatchCta = flight.autoImportStatus === "AMBIGUOUS";
  const showAutoImportNotFound = flight.autoImportStatus === "NOT_FOUND";
  const showAutoImportFailed = flight.autoImportStatus === "FAILED";
  const isImported = Boolean(
    flight.importedProvider ||
      flight.providerFlightId ||
      ["IMPORTED", "COMPLETED"].includes(flight.status)
  );
  const hasAnyLogbookEntry = flight.logbookEntries.length > 0;
  const hasCosts = flight.costItems.length > 0;
  const hasReceipts = flight.receiptDocuments.length > 0;
  const needsAdsB = !isImported;
  const needsLogbook = !hasAnyLogbookEntry;
  const needsCosts = !hasCosts;
  const needsReceipts = !hasReceipts;
  const checklistSummary = flight.checklistRuns.reduce<
    Record<"PREFLIGHT" | "POSTFLIGHT", string>
  >(
    (acc, run) => {
      acc[run.phase] = run.status;
      return acc;
    },
    { PREFLIGHT: "NOT_AVAILABLE", POSTFLIGHT: "NOT_AVAILABLE" }
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">Flight details</h2>
          <FlightStatusBadge status={flight.status} />
        </div>
        <p className="text-sm text-slate-400">
          {flight.tailNumberSnapshot ?? flight.tailNumber} · {flight.origin} →{" "}
          {flight.destination ?? "TBD"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Summary</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-400">Tail number</p>
              <p className="text-lg font-semibold">
                {flight.tailNumberSnapshot ?? flight.tailNumber}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Planned time</p>
              <p className="text-sm text-slate-100">
                {flight.plannedStartTime
                  ? flight.plannedStartTime.toLocaleString()
                  : "—"}
              </p>
              <p className="text-xs text-slate-400">
                {flight.plannedEndTime
                  ? `End ${flight.plannedEndTime.toLocaleString()}`
                  : "No planned end time"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Imported time</p>
              <p className="text-sm text-slate-100">
                {isImported ? flight.startTime.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-slate-400">
                {isImported
                  ? flight.endTime
                    ? `End ${flight.endTime.toLocaleString()}`
                    : "No imported end time"
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Duration</p>
              <p className="text-lg font-semibold">
                {isImported && flight.durationMinutes !== null
                  ? `${flight.durationMinutes} mins`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Distance</p>
              <p className="text-lg font-semibold">
                {isImported && flight.distanceNm !== null
                  ? `${flight.distanceNm} nm`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Max altitude</p>
              <p className="text-lg font-semibold">
                {maxAltitude ? `${maxAltitude.toLocaleString()} ft` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Quick actions</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/flights/${flight.id}/match`}>Import / attach ADS-B</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/import?flightId=${flight.id}`}>Manual ADS-B import</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/flights/${flight.id}/checklists`}>Checklists</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/flights/${flight.id}/costs`}>Costs & receipts</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/flights/${flight.id}/logbook`}>Logbook</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-300 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Checklists</p>
              <p className="mt-1">
                Preflight: <span className="text-slate-100">{checklistSummary.PREFLIGHT}</span>{" "}
                · Postflight:{" "}
                <span className="text-slate-100">{checklistSummary.POSTFLIGHT}</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Costs</p>
              <p className="mt-1">
                Total:{" "}
                <span className="text-slate-100">
                  {costTotalCents > 0 ? currencyFormatter.format(costTotalCents / 100) : "—"}
                </span>{" "}
                · Receipts: <span className="text-slate-100">{flight.receiptDocuments.length}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(needsAdsB || needsLogbook || needsCosts || needsReceipts) && (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Next steps</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm text-slate-300">
              {needsAdsB ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <span>Attach ADS-B track data (optional, but unlocks stats/map).</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/match`}>Find match</Link>
                  </Button>
                </div>
              ) : null}
              {needsLogbook ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
                  <span>Create a logbook entry for the flight.</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/logbook`}>Open logbook</Link>
                  </Button>
                </div>
              ) : null}
              {needsCosts ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
                  <span>Add costs (fuel, rental, maintenance, etc.).</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/costs`}>Add costs</Link>
                  </Button>
                </div>
              ) : null}
              {needsReceipts ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
                  <span>Upload receipts and link them to cost items.</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/costs`}>Upload receipts</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {showAutoImportRunning ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
            Importing ADS-B…
          </div>
        </div>
      ) : null}

      {showAutoImportSuccess ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          ADS-B data imported.
        </div>
      ) : null}

      {showAutoImportNotFound ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
            <span>No ADS-B match found. Manually import and attach.</span>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/import?flightId=${flight.id}`}>
                Manually import and attach
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {showAutoImportMatchCta ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
            <span>Multiple ADS-B matches found. Choose the best one to attach.</span>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/flights/${flight.id}/match`}>Select match</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {showAutoImportFailed ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          ADS-B import failed. Please try again or manually attach a flight.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Route map</p>
        </CardHeader>
        <CardContent>
          {flight.trackPoints.length > 1 ? (
            <div className="h-80">
              <FlightMap track={flight.trackPoints ?? undefined} />
            </div>
          ) : (
            <EmptyState
              title="No track data yet"
              description="Import ADS-B data to view the flight track."
            />
          )}
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
    </div>
  );
}
