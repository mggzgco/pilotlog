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
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { Input } from "@/app/components/ui/input";
import { FlightChecklistTemplateSelector } from "@/app/components/flights/flight-checklist-template-selector";
import { formatFlightRouteLabel } from "@/app/lib/flights/route-label";
import { formatDateTime24 } from "@/app/lib/utils";
import { EditAircraftFromFlightModal } from "@/app/components/aircraft/edit-aircraft-from-flight-modal";

const formatPersonName = (person: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) =>
  person.name ||
  [person.firstName, person.lastName].filter(Boolean).join(" ") ||
  person.email ||
  "—";

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
      stops: { orderBy: { order: "asc" } },
      aircraft: {
        include: {
          aircraftType: {
            select: {
              name: true,
              defaultPreflightTemplateId: true,
              defaultPostflightTemplateId: true
            }
          }
        }
      },
      costItems: { select: { id: true, amountCents: true } },
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
      },
      peopleParticipants: {
        include: { person: true },
        orderBy: { createdAt: "asc" }
      },
      receiptDocuments: {
        where: { storagePath: { startsWith: "photo_" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalFilename: true,
          contentType: true,
          createdAt: true,
          sizeBytes: true,
          storagePath: true
        }
      },
      checklistRuns: {
        select: { id: true, phase: true, status: true, decision: true, startedAt: true }
      }
    }
  });

  if (!flight) {
    notFound();
  }

  const plotPointsRaw = flight.trackPoints.map((point) => ({
    recordedAt: point.recordedAt.toISOString(),
    altitudeFeet: point.altitudeFeet,
    groundspeedKt: point.groundspeedKt
  }));
  const altitudePoints = plotPointsRaw
    .filter((point) => point.altitudeFeet !== null)
    .map((point) => ({
      recordedAt: point.recordedAt,
      altitudeFeet: point.altitudeFeet as number
    }));
  const maxAltitudeRaw =
    altitudePoints.length > 0
      ? Math.max(...altitudePoints.map((point) => point.altitudeFeet))
      : null;
  // Backward-compatible display fix: some imported tracks store altitude as
  // "hundreds of feet" (e.g. 34 => 3,400 ft). Detect and scale for display.
  const altitudeDisplayScale =
    maxAltitudeRaw !== null && maxAltitudeRaw > 0 && maxAltitudeRaw <= 250 ? 100 : 1;
  const altitudePointsDisplay =
    altitudeDisplayScale === 1
      ? altitudePoints
      : altitudePoints.map((point) => ({
          ...point,
          altitudeFeet: Math.round(point.altitudeFeet * altitudeDisplayScale)
        }));
  const plotPointsDisplay =
    altitudeDisplayScale === 1
      ? plotPointsRaw
      : plotPointsRaw.map((point) => ({
          ...point,
          altitudeFeet:
            typeof point.altitudeFeet === "number"
              ? Math.round(point.altitudeFeet * altitudeDisplayScale)
              : null
        }));
  const maxAltitude =
    altitudePointsDisplay.length > 0
      ? Math.max(...altitudePointsDisplay.map((point) => point.altitudeFeet))
      : null;
  const aircraftProfileLabel = flight.aircraft?.aircraftType?.name ?? null;
  const aircraftMakeModelLabel =
    [flight.aircraft?.manufacturer, flight.aircraft?.model].filter(Boolean).join(" ") || "—";
  const aircraftCategoryLabel = (() => {
    switch (flight.aircraft?.category) {
      case "SINGLE_ENGINE_PISTON":
        return "Single-engine piston";
      case "MULTI_ENGINE_PISTON":
        return "Multi-engine piston";
      case "SINGLE_ENGINE_TURBINE":
        return "Single-engine turbine";
      case "MULTI_ENGINE_TURBINE":
        return "Multi-engine turbine";
      case "JET":
        return "Jet";
      case "HELICOPTER":
        return "Helicopter";
      case "GLIDER":
        return "Glider";
      default:
        return "Other";
    }
  })();
  const costTotalCents = flight.costItems.reduce(
    (total, item) => total + item.amountCents,
    0
  );
  const groundspeedValues = flight.trackPoints
    .map((point) => point.groundspeedKt)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const minSpeedKt =
    groundspeedValues.length > 0 ? Math.min(...groundspeedValues) : null;
  const maxSpeedKt =
    groundspeedValues.length > 0 ? Math.max(...groundspeedValues) : null;
  const avgSpeedKt =
    groundspeedValues.length > 0
      ? Math.round(
          groundspeedValues.reduce((sum, value) => sum + value, 0) /
            groundspeedValues.length
        )
      : null;
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

  const assignedPreflightTemplateId =
    flight.aircraft?.preflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPreflightTemplateId ??
    null;
  const assignedPostflightTemplateId =
    flight.aircraft?.postflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPostflightTemplateId ??
    null;
  const hasAnyAssignedChecklistTemplate = Boolean(
    assignedPreflightTemplateId || assignedPostflightTemplateId
  );

  const preflightRun = assignedPreflightTemplateId
    ? flight.checklistRuns.find((run) => run.phase === "PREFLIGHT") ?? null
    : null;
  const postflightRun = assignedPostflightTemplateId
    ? flight.checklistRuns.find((run) => run.phase === "POSTFLIGHT") ?? null
    : null;

  const [logbookEntries, receiptCount, preflightRemainingRequired, postflightRemainingRequired, preflightTemplates, postflightTemplates] =
    await Promise.all([
    prisma.logbookEntry.findMany({
      where: { flightId: flight.id },
      select: {
        id: true,
        status: true,
        totalTime: true,
        dayTakeoffs: true,
        nightTakeoffs: true,
        dayLandings: true,
        nightLandings: true
      }
    }),
    prisma.receiptDocument.count({
      where: { flightId: flight.id, userId: user.id, NOT: { storagePath: { startsWith: "photo_" } } }
    }),
    preflightRun
      ? prisma.flightChecklistItem.count({
          where: {
            checklistRunId: preflightRun.id,
            kind: "STEP",
            required: true,
            completed: false
          }
        })
      : Promise.resolve(null),
    postflightRun
      ? prisma.flightChecklistItem.count({
          where: {
            checklistRunId: postflightRun.id,
            kind: "STEP",
            required: true,
            completed: false
          }
        })
      : Promise.resolve(null)
    ,
    prisma.checklistTemplate.findMany({
      where: { userId: user.id, phase: "PREFLIGHT" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true }
    }),
    prisma.checklistTemplate.findMany({
      where: { userId: user.id, phase: "POSTFLIGHT" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  const logbookEntryCount = logbookEntries.length;
  const hasAnyLogbookEntry = logbookEntryCount > 0;
  const hasCosts = flight.costItems.length > 0;
  const hasReceipts = receiptCount > 0;
  const needsAdsB = !isImported;
  const needsLogbook = !hasAnyLogbookEntry;
  const needsCosts = !hasCosts;
  const needsReceipts = !hasReceipts;
  const preflightIsAccepted =
    preflightRun?.status === "SIGNED" && preflightRun.decision !== "REJECTED";
  const canStartPostflight = preflightIsAccepted || flight.status === "COMPLETED" || flight.endTime;
  const postflightIsAccepted =
    postflightRun?.status === "SIGNED" && postflightRun.decision !== "REJECTED";
  const needsPreflightChecklist = Boolean(
    assignedPreflightTemplateId && !preflightIsAccepted
  );
  const needsPostflightChecklist = Boolean(
    assignedPostflightTemplateId && canStartPostflight && !postflightIsAccepted
  );
  const checklistSummary = flight.checklistRuns.reduce<
    Record<"PREFLIGHT" | "POSTFLIGHT", string>
  >(
    (acc, run) => {
      acc[run.phase] = run.status;
      return acc;
    },
    { PREFLIGHT: "NOT_AVAILABLE", POSTFLIGHT: "NOT_AVAILABLE" }
  );

  const checklistStatusLabel = (run: typeof preflightRun | typeof postflightRun) => {
    if (!run) return "Not started";
    if (run.status === "IN_PROGRESS") return "In progress";
    if (run.status === "SIGNED") {
      return run.decision === "REJECTED" ? "Closed (incomplete)" : "Signed";
    }
    return "Not available";
  };

  const flightNotes =
    flight.statsJson &&
    typeof flight.statsJson === "object" &&
    !Array.isArray(flight.statsJson) &&
    typeof (flight.statsJson as Record<string, unknown>).userNotes === "string"
      ? String((flight.statsJson as Record<string, unknown>).userNotes)
      : "";

  const checklistOverrides =
    flight.statsJson &&
    typeof flight.statsJson === "object" &&
    !Array.isArray(flight.statsJson) &&
    typeof (flight.statsJson as Record<string, unknown>).checklistTemplateOverrides === "object" &&
    (flight.statsJson as Record<string, unknown>).checklistTemplateOverrides !== null
      ? ((flight.statsJson as Record<string, unknown>).checklistTemplateOverrides as Record<
          string,
          unknown
        >)
      : {};
  const selectedPreflightTemplateId =
    typeof checklistOverrides.preflightTemplateId === "string"
      ? checklistOverrides.preflightTemplateId
      : null;
  const selectedPostflightTemplateId =
    typeof checklistOverrides.postflightTemplateId === "string"
      ? checklistOverrides.postflightTemplateId
      : null;

  const flightPeople = [
    ...flight.participants.map((participant) => ({
      id: participant.id,
      name: formatPersonName(participant.user),
      role: participant.role
    })),
    ...flight.peopleParticipants.map((participant) => ({
      id: participant.id,
      name: participant.person.name,
      role: participant.role
    }))
  ];

  const logbookStatusLabel = !hasAnyLogbookEntry
    ? "Not started"
    : logbookEntries.some((entry) => entry.status === "OPEN")
      ? "Open"
      : "Closed";

  const logbookTotals = logbookEntries.reduce(
    (acc, entry) => {
      const totalTime = entry.totalTime ? Number(entry.totalTime) : 0;
      acc.totalHours += Number.isFinite(totalTime) ? totalTime : 0;
      acc.takeoffs += (entry.dayTakeoffs ?? 0) + (entry.nightTakeoffs ?? 0);
      acc.landings += (entry.dayLandings ?? 0) + (entry.nightLandings ?? 0);
      return acc;
    },
    { totalHours: 0, takeoffs: 0, landings: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">Flight details</h2>
              <FlightStatusBadge status={flight.status} />
            </div>
            <p className="text-sm text-slate-400">
              {flight.tailNumberSnapshot ?? flight.tailNumber} ·{" "}
              {formatFlightRouteLabel({
                origin: flight.origin,
                stops: (flight as any).stops ?? [],
                destination: flight.destination ?? "TBD"
              })}
            </p>
            {flightPeople.length > 0 ? (
              <p className="text-xs text-slate-500">
                People: {flightPeople.map((person) => `${person.name} (${person.role})`).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick links
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/flights/${flight.id}/match`}
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                ADS-B match
              </Link>
              {flight.importedProvider === "aeroapi" && flight.providerFlightId ? (
                <form action={`/api/flights/${flight.id}/adsb/refresh`} method="post">
                  <FormSubmitButton
                    type="submit"
                    size="sm"
                    variant="outline"
                    pendingText="Refreshing..."
                    className="h-auto rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
                  >
                    Refresh ADS-B
                  </FormSubmitButton>
                </form>
              ) : null}
              <Link
                href={`/import?flightId=${flight.id}`}
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Manual import
              </Link>
              {hasAnyAssignedChecklistTemplate ? (
                <Link
                  href={`/flights/${flight.id}/checklists`}
                  className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
                >
                  Checklists
                </Link>
              ) : null}
              <Link
                href={`/flights/${flight.id}/costs`}
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Costs
              </Link>
              <Link
                href={`/flights/${flight.id}/logbook`}
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Logbook
              </Link>
              <Link
                href="#stats"
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Stats
              </Link>
              <Link
                href="#notes"
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Notes
              </Link>
              <Link
                href="#photos"
                className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                Photos
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Route map</p>
          </CardHeader>
          <CardContent>
            {flight.trackPoints.length > 1 ? (
              <div className="h-96">
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

        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Altitude profile</p>
          </CardHeader>
          <CardContent>
            {altitudePointsDisplay.length > 1 ? (
              <AltitudeChart points={plotPointsDisplay} />
            ) : (
              <EmptyState
                title="No altitude profile yet"
                description="Import ADS-B data to see the altitude profile."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="stats">
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Stats</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-6 lg:grid-rows-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 lg:col-span-2 lg:row-span-2">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                Aircraft
              </p>
              <div className="mt-3 flex items-start gap-5">
                {flight.aircraft?.photoStoragePath ? (
                  <div className="h-48 w-48 overflow-hidden rounded-xl bg-transparent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/aircraft/${flight.aircraft.id}/photo`}
                      alt={`${flight.tailNumberSnapshot ?? flight.tailNumber} aircraft photo`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-48 w-48 rounded-xl bg-transparent" />
                )}
                <div className="min-w-0">
                  <p className="text-2xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
                    {flight.tailNumberSnapshot ?? flight.tailNumber}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {aircraftMakeModelLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {aircraftCategoryLabel}
                    {aircraftProfileLabel ? ` · ${aircraftProfileLabel}` : ""}
                  </p>
                  {flight.aircraft ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <EditAircraftFromFlightModal
                        flightId={flight.id}
                        aircraft={{
                          id: flight.aircraft.id,
                          tailNumber: flight.aircraft.tailNumber,
                          manufacturer: flight.aircraft.manufacturer,
                          model: flight.aircraft.model,
                          category: flight.aircraft.category as any
                        }}
                      />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/aircraft/${flight.aircraft.id}`}>Full aircraft page</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Planned</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {flight.plannedStartTime
                  ? formatDateTime24(flight.plannedStartTime)
                  : "—"}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {flight.plannedEndTime
                  ? `End ${formatDateTime24(flight.plannedEndTime)}`
                  : "No planned end time"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Imported</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isImported ? formatDateTime24(flight.startTime) : "—"}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isImported
                  ? flight.endTime
                    ? `End ${formatDateTime24(flight.endTime)}`
                    : "No imported end time"
                  : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Duration</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isImported && flight.durationMinutes !== null
                  ? `${flight.durationMinutes} mins`
                  : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Distance</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isImported && flight.distanceNm !== null
                  ? `${flight.distanceNm} nm`
                  : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Max altitude</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {maxAltitude ? `${maxAltitude.toLocaleString()} ft` : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Min speed</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {minSpeedKt !== null ? `${Math.round(minSpeedKt)} kt` : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Avg speed</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {avgSpeedKt !== null ? `${avgSpeedKt} kt` : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Max speed</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {maxSpeedKt !== null ? `${Math.round(maxSpeedKt)} kt` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
      {showAutoImportRunning ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
            Importing ADS-B…
          </div>
        </div>
      ) : null}

      {showAutoImportNotFound ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex flex-col gap-2 lg:flex-row md:items-center md:justify-between">
            <span>No ADS-B match found. Manually import and attach.</span>
            <Button size="sm" variant="outline" asChild>
                <Link href={`/import?flightId=${flight.id}`}>Manually import and attach</Link>
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
            </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
        <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">Costs</p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/flights/${flight.id}/costs`}>Open costs</Link>
              </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total</p>
                <p className="text-lg font-semibold">
                  {costTotalCents > 0 ? currencyFormatter.format(costTotalCents / 100) : "—"}
                </p>
                    </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Receipts</p>
                <p className="text-lg font-semibold">{receiptCount}</p>
                </div>
            </div>
            {!hasCosts ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                No costs yet — add fuel, rental, instruction, etc.
              </div>
            ) : null}
        </CardContent>
      </Card>

        <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">Logbook</p>
            <Button asChild variant="outline" size="sm">
                <Link href={`/flights/${flight.id}/logbook`}>Open logbook</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total hours</p>
                <p className="text-lg font-semibold">
                  {hasAnyLogbookEntry ? logbookTotals.totalHours.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {logbookStatusLabel}
                  {logbookEntryCount ? ` · ${logbookEntryCount} entry${logbookEntryCount === 1 ? "" : "ies"}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Takeoffs</p>
                <p className="text-lg font-semibold">{hasAnyLogbookEntry ? logbookTotals.takeoffs : "—"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Day + night</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Landings</p>
                <p className="text-lg font-semibold">{hasAnyLogbookEntry ? logbookTotals.landings : "—"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Day + night</p>
              </div>
            </div>
            {!hasAnyLogbookEntry ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                No logbook entry yet — log hours and remarks.
            </div>
          ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="notes">
          <CardHeader>
            <p className="text-sm text-slate-400">Flight notes</p>
          </CardHeader>
          <CardContent>
            <form action={`/api/flights/${flight.id}/notes`} method="post" className="grid gap-3">
              <textarea
                name="notes"
                className="min-h-[160px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                placeholder="Notes about this flight (training focus, weather, debrief, squawks, learnings)"
                defaultValue={flightNotes}
              />
              <div className="flex flex-wrap gap-3">
                <FormSubmitButton type="submit" pendingText="Saving notes...">
                  Save notes
                </FormSubmitButton>
                <Button variant="outline" asChild>
                  <Link href={`/flights/${flight.id}/checklists`}>Go to checklists</Link>
                </Button>
              </div>
            </form>
        </CardContent>
      </Card>

        <Card id="photos">
        <CardHeader>
            <p className="text-sm text-slate-400">Flight photos</p>
        </CardHeader>
        <CardContent>
            <form
              action={`/api/flights/${flight.id}/receipts/upload`}
              method="post"
              encType="multipart/form-data"
              className="grid gap-3"
            >
              <input type="hidden" name="kind" value="photo" />
              <Input
                name="receipts"
                type="file"
                accept="image/png,image/jpeg"
                multiple
                required
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <FormSubmitButton type="submit" pendingText="Uploading photos...">
                  Upload photos
                </FormSubmitButton>
                <span>JPG/PNG up to 10MB each.</span>
            </div>
            </form>

            {flight.receiptDocuments.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
                No photos uploaded yet.
                  </div>
                ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {flight.receiptDocuments.map((photo) => (
                  <div key={photo.id} className="rounded-lg border border-slate-800 bg-slate-950/30 p-2">
                    {photo.contentType?.startsWith("image/") ? (
                      <Link href={`/api/receipts/${photo.id}/download`} className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/receipts/${photo.id}/preview`}
                          alt={photo.originalFilename}
                          className="h-32 w-full rounded-md object-cover"
                        />
                      </Link>
                    ) : (
                      <div className="h-32 rounded-md border border-dashed border-slate-800 p-3 text-xs text-slate-400">
                        Preview not available.
                        </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-300" title={photo.originalFilename}>
                        {photo.originalFilename}
                      </p>
                      <form action={`/api/receipts/${photo.id}/delete`} method="post">
                            <FormSubmitButton
                              type="submit"
                              size="sm"
                              variant="outline"
                              pendingText="Deleting..."
                            >
                              Delete
                            </FormSubmitButton>
                          </form>
                        </div>
                      </div>
                ))}
                </div>
              )}
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Checklists</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/flights/${flight.id}/checklists`}>Open checklists</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasAnyAssignedChecklistTemplate ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              No checklists assigned to this aircraft.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {assignedPreflightTemplateId ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Pre-flight
                    </p>
                    <FlightChecklistTemplateSelector
                      flightId={flight.id}
                      phase="PREFLIGHT"
                      templates={preflightTemplates}
                      defaultTemplateId={assignedPreflightTemplateId}
                      selectedTemplateId={selectedPreflightTemplateId}
                      disabled={preflightRun?.status === "SIGNED" || Boolean(preflightRun?.startedAt)}
                    />
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {checklistStatusLabel(preflightRun)}
                      {typeof preflightRemainingRequired === "number"
                        ? ` · ${preflightRemainingRequired} required remaining`
                        : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/checklists?tab=preflight`}>
                      {preflightRun ? "Continue" : "Start"}
                    </Link>
                  </Button>
                </div>
              ) : null}

              {assignedPostflightTemplateId ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Post-flight
                    </p>
                    <FlightChecklistTemplateSelector
                      flightId={flight.id}
                      phase="POSTFLIGHT"
                      templates={postflightTemplates}
                      defaultTemplateId={assignedPostflightTemplateId}
                      selectedTemplateId={selectedPostflightTemplateId}
                      disabled={postflightRun?.status === "SIGNED" || Boolean(postflightRun?.startedAt)}
                    />
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {canStartPostflight ? (
                        <>
                          {checklistStatusLabel(postflightRun)}
                          {typeof postflightRemainingRequired === "number"
                            ? ` · ${postflightRemainingRequired} required remaining`
                            : ""}
                        </>
                      ) : (
                        "Locked until pre-flight is signed (or flight completes)"
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    disabled={!canStartPostflight}
                  >
                    <Link href={`/flights/${flight.id}/checklists?tab=postflight`}>
                      {postflightRun ? "Continue" : "Start"}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {(needsAdsB ||
        needsLogbook ||
        needsCosts ||
        needsReceipts ||
        needsPreflightChecklist ||
        needsPostflightChecklist) && (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Next steps</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm text-slate-300">
              {needsPreflightChecklist ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
                  <span>
                    Complete pre-flight checklist.
                    {typeof preflightRemainingRequired === "number"
                      ? ` (${preflightRemainingRequired} required remaining)`
                      : ""}
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/checklists?tab=preflight`}>
                      Open pre-flight
                    </Link>
                  </Button>
                </div>
              ) : null}
              {needsPostflightChecklist ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
                  <span>
                    Complete post-flight checklist.
                    {typeof postflightRemainingRequired === "number"
                      ? ` (${postflightRemainingRequired} required remaining)`
                      : ""}
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/flights/${flight.id}/checklists?tab=postflight`}>
                      Open post-flight
                    </Link>
                  </Button>
                </div>
              ) : null}
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
    </div>
  );
}
