import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { FlightMap } from "@/app/components/maps/flight-map";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AltitudeChart } from "@/app/components/charts/AltitudeChart";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { Receipt } from "lucide-react";
import { ChecklistSection } from "@/app/components/flights/checklist-section";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";
import { participantRoleOptions } from "@/app/lib/flights/participants";
import { CostItemForm } from "@/app/components/flights/cost-item-form";
import { getCostCategoryLabel } from "@/app/lib/costs/categories";
import { CompleteFlightAction } from "@/app/components/flights/complete-flight-action";
import { LogbookEntryForm } from "@/app/components/flights/logbook-entry-form";

export default async function FlightDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { participantId?: string; receiptCostItemId?: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      costItems: { orderBy: { date: "desc" } },
      logbookEntries: { select: { id: true } },
      receiptDocuments: {
        orderBy: { createdAt: "desc" },
        include: {
          costItem: { select: { id: true, category: true, amountCents: true } }
        }
      },
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
      },
      checklistRuns: {
        include: { items: { orderBy: { order: "asc" } } }
      }
    }
  });

  if (!flight) {
    notFound();
  }

  let participants = flight.participants;
  if (participants.length === 0) {
    const ownerParticipant = await prisma.flightParticipant.create({
      data: {
        flightId: flight.id,
        userId: user.id,
        role: "PIC"
      },
      include: { user: true }
    });
    participants = [ownerParticipant];
  }

  const defaultParticipant =
    participants.find((participant) => participant.userId === user.id) ??
    participants[0] ??
    null;
  const selectedParticipantId =
    searchParams?.participantId ?? defaultParticipant?.id ?? null;
  const selectedParticipant =
    participants.find((participant) => participant.id === selectedParticipantId) ??
    defaultParticipant;

  const logbookEntry = selectedParticipant
    ? await prisma.logbookEntry.findFirst({
        where: { flightId: flight.id, userId: selectedParticipant.userId }
      })
    : null;
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
  const formatBytes = (bytes: number | null) => {
    if (!bytes && bytes !== 0) {
      return "—";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const defaultSignatureName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    user.email;
  const toChecklistRunView = (run: typeof flight.checklistRuns[number]) => ({
    id: run.id,
    phase: run.phase,
    status: run.status,
    decision: run.decision,
    decisionNote: run.decisionNote,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    signedAt: run.signedAt ? run.signedAt.toISOString() : null,
    signatureName: run.signatureName,
    items: run.items.map((item) => ({
      id: item.id,
      order: item.order,
      title: item.title,
      details: item.details,
      required: item.required,
      inputType: item.inputType,
      completed: item.completed,
      valueText: item.valueText,
      valueNumber: item.valueNumber,
      valueYesNo: item.valueYesNo,
      notes: item.notes,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null
    }))
  });
  const preflightRun =
    flight.checklistRuns.find((run) => run.phase === "PREFLIGHT") ?? null;
  const postflightRun =
    flight.checklistRuns.find((run) => run.phase === "POSTFLIGHT") ?? null;
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
  const hasLogbookEntry = Boolean(logbookEntry);
  const hasAnyLogbookEntry = flight.logbookEntries.length > 0;
  const showLogbookPrompt = isImported && logbookEntry?.totalTime == null;
  const prefillTotalTime =
    logbookEntry?.totalTime?.toString() ??
    (showLogbookPrompt && flight.durationMinutes !== null
      ? (flight.durationMinutes / 60).toFixed(1)
      : "");
  const prefillPicTime =
    logbookEntry?.picTime?.toString() ??
    (selectedParticipant?.role === "PIC" && prefillTotalTime
      ? prefillTotalTime
      : "");
  const prefillSicTime =
    logbookEntry?.sicTime?.toString() ??
    (selectedParticipant?.role === "SIC" && prefillTotalTime
      ? prefillTotalTime
      : "");
  const logbookDefaultDate = logbookEntry?.date
    ? logbookEntry.date.toISOString().slice(0, 10)
    : flight.startTime.toISOString().slice(0, 10);
  const logbookDefaultNightTime = logbookEntry?.nightTime?.toString() ?? "";
  const logbookDefaultInstrumentTime =
    logbookEntry?.instrumentTime?.toString() ?? "";
  const logbookDefaultRemarks = logbookEntry?.remarks ?? "";
  const users = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, name: true, email: true }
  });
  const participantOptions = users.map((entry) => ({
    id: entry.id,
    label:
      [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
      entry.name ||
      entry.email
  }));
  const formatCurrencyInput = (amountCents: number | null) =>
    amountCents === null ? "" : (amountCents / 100).toFixed(2);
  const formatDecimalInput = (value: number | string | { toString(): string } | null) => {
    if (value === null || value === undefined) {
      return "";
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "";
  };
  const receiptFilter = searchParams?.receiptCostItemId ?? "all";
  const receiptDocuments = flight.receiptDocuments.filter((receipt) => {
    if (receiptFilter === "all") {
      return true;
    }
    if (receiptFilter === "unassigned") {
      return receipt.costItemId === null;
    }
    return receipt.costItemId === receiptFilter;
  });
  const receiptCostItemLabel = (receipt: typeof flight.receiptDocuments[number]) =>
    receipt.costItem
      ? `${getCostCategoryLabel(receipt.costItem.category)} · ${currencyFormatter.format(
          receipt.costItem.amountCents / 100
        )}`
      : "Unassigned";
  const receiptUploadDefaultCostItemId =
    receiptFilter !== "all" && receiptFilter !== "unassigned"
      ? receiptFilter
      : "";
  const decisionLabel = (
    run: (typeof flight.checklistRuns)[number] | null
  ): "Accepted" | "Rejected" | "—" => {
    if (!run || run.status !== "SIGNED") {
      return "—";
    }
    if (run.decision === "REJECTED") {
      return "Rejected";
    }
    if (run.decision === "ACCEPTED") {
      return "Accepted";
    }
    const hasRejected = run.items.some(
      (item) =>
        item.required && item.inputType === "YES_NO" && item.valueYesNo === false
    );
    return hasRejected ? "Rejected" : "Accepted";
  };
  const postflightDecision = decisionLabel(postflightRun);
  const isPostflightAccepted = postflightDecision === "Accepted";
  const hasCosts = flight.costItems.length > 0;
  const hasReceipts = flight.receiptDocuments.length > 0;
  const needsAdsB = !isImported;
  const needsLogbook = !hasAnyLogbookEntry;
  const needsCosts = !hasCosts;
  const needsReceipts = !hasReceipts;
  const showCompletionPanel =
    isPostflightAccepted && (needsAdsB || needsLogbook || needsCosts || needsReceipts);
  const showImportQuickAction = needsAdsB;

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

      {showAutoImportRunning ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
            Importing ADS-B…
          </div>
        </div>
      ) : null}

      {showImportQuickAction ? (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Import ADS-B (optional)</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <p className="text-sm text-slate-300">
                Import a track now, even if you have not started the checklists. This is
                handy for post-hoc flight entry.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/flights/${flight.id}/match`}>Select ADS-B match</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/import?flightId=${flight.id}`}>Manual import</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showAutoImportSuccess ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          ADS-B data imported. Please complete your logbook entry.
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

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Statistics</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4">
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
                {costTotalCents > 0
                  ? currencyFormatter.format(costTotalCents / 100)
                  : "--"}
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
          <p className="text-sm text-slate-400">Checklists</p>
        </CardHeader>
        <CardContent>
          <ChecklistSection
            flightId={flight.id}
            flightStatus={flight.status}
            aircraftId={flight.aircraftId}
            defaultSignatureName={defaultSignatureName}
            preflightRun={preflightRun ? toChecklistRunView(preflightRun) : null}
            postflightRun={postflightRun ? toChecklistRunView(postflightRun) : null}
          />
        </CardContent>
      </Card>

      {showCompletionPanel ? (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Complete this Flight</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {needsAdsB ? (
                <CompleteFlightAction
                  label="Import ADS-B"
                  title="Import ADS-B data"
                  description="Attach a track to finalize this flight."
                >
                  <p className="text-sm text-slate-300">
                    Select the best ADS-B match for{" "}
                    {flight.tailNumberSnapshot ?? flight.tailNumber} or upload
                    manually.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={`/flights/${flight.id}/match`}>
                        Select ADS-B match
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/import?flightId=${flight.id}`}>
                        Manual import
                      </Link>
                    </Button>
                  </div>
                </CompleteFlightAction>
              ) : null}
              {needsLogbook ? (
                <CompleteFlightAction
                  label="Log Hours"
                  title="Log hours"
                  description="Pre-filled with the selected participant and flight date."
                >
                  <LogbookEntryForm
                    flightId={flight.id}
                    participantId={selectedParticipant?.id ?? null}
                    defaultDate={logbookDefaultDate}
                    defaultTotalTime={prefillTotalTime}
                    defaultPicTime={prefillPicTime}
                    defaultSicTime={prefillSicTime}
                    defaultNightTime={logbookDefaultNightTime}
                    defaultInstrumentTime={logbookDefaultInstrumentTime}
                    defaultRemarks={logbookDefaultRemarks}
                    hasLogbookEntry={hasLogbookEntry}
                  />
                </CompleteFlightAction>
              ) : null}
              {needsCosts ? (
                <CompleteFlightAction
                  label="Add Costs"
                  title="Add a cost item"
                  description="Log expenses tied to this flight."
                >
                  <CostItemForm
                    action={`/api/flights/${flight.id}/cost-items/create`}
                    submitLabel="Save cost item"
                    pendingText="Saving cost item..."
                    defaultValues={{
                      category: "",
                      amount: "",
                      date: flight.startTime.toISOString().slice(0, 10),
                      vendor: "",
                      notes: ""
                    }}
                  />
                </CompleteFlightAction>
              ) : null}
              {needsReceipts ? (
                <CompleteFlightAction
                  label="Upload Receipts"
                  title="Upload receipts"
                  description="Attach receipts to the costs you logged."
                >
                  <form
                    action={`/api/flights/${flight.id}/receipts/upload`}
                    method="post"
                    encType="multipart/form-data"
                    className="grid gap-3 lg:grid-cols-3"
                  >
                    <select
                      name="costItemId"
                      defaultValue={receiptUploadDefaultCostItemId}
                      className="h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Link to cost item (optional)</option>
                      {flight.costItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.category} ·{" "}
                          {currencyFormatter.format(item.amountCents / 100)}
                        </option>
                      ))}
                    </select>
                    <Input
                      id="receipt-upload-completion"
                      name="receipts"
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      multiple
                      required
                      className="lg:col-span-2"
                    />
                    <div className="lg:col-span-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <FormSubmitButton type="submit" pendingText="Uploading...">
                        Upload receipts
                      </FormSubmitButton>
                      <span>PDF, JPG, PNG up to 10MB each.</span>
                    </div>
                  </form>
                </CompleteFlightAction>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Participants</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-lg border border-slate-800 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {participant.user.name ||
                          [participant.user.firstName, participant.user.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          participant.user.email}
                      </p>
                      <p className="text-xs text-slate-400">{participant.user.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <form
                        action={`/api/flights/${flight.id}/participants/update-role`}
                        method="post"
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="participantId"
                          value={participant.id}
                        />
                        <select
                          name="role"
                          defaultValue={participant.role}
                          className="h-11 rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                        >
                          {participantRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <FormSubmitButton
                          type="submit"
                          size="sm"
                          variant="outline"
                          pendingText="Saving..."
                        >
                          Update role
                        </FormSubmitButton>
                      </form>
                      {participant.userId !== user.id ? (
                        <form
                          action={`/api/flights/${flight.id}/participants/remove`}
                          method="post"
                        >
                          <input
                            type="hidden"
                            name="participantId"
                            value={participant.id}
                          />
                          <FormSubmitButton
                            type="submit"
                            size="sm"
                            variant="outline"
                            pendingText="Removing..."
                          >
                            Remove
                          </FormSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form
              action={`/api/flights/${flight.id}/participants/add`}
              method="post"
              className="grid gap-3 lg:grid-cols-3"
            >
              <select
                name="userId"
                className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select a user
                </option>
                {participantOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.label}
                  </option>
                ))}
              </select>
              <select
                name="role"
                className="h-11 w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                defaultValue="SIC"
              >
                {participantRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <div className="lg:col-span-3">
                <FormSubmitButton type="submit" pendingText="Adding participant...">
                  Add participant
                </FormSubmitButton>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">Logbook entry</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/logbook?flightId=${flight.id}`}>Log Hours</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showLogbookPrompt ? (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Complete your logbook entry to finish this imported flight. Total
              time has been prefilled from ADS-B when available.
            </div>
          ) : null}
          {!hasLogbookEntry ? (
            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
              No logbook entry yet for this participant. Create one to track flight
              time and notes.
            </div>
          ) : null}
          {participants.length > 1 ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Logbook participant
                </label>
                <select
                  name="participantId"
                  defaultValue={selectedParticipant?.id}
                  className="h-11 rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                >
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.user.name ||
                        [participant.user.firstName, participant.user.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        participant.user.email}{" "}
                      ({participant.role})
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                View logbook
              </Button>
            </form>
          ) : null}
          <LogbookEntryForm
            flightId={flight.id}
            participantId={selectedParticipant?.id ?? null}
            defaultDate={logbookDefaultDate}
            defaultTotalTime={prefillTotalTime}
            defaultPicTime={prefillPicTime}
            defaultSicTime={prefillSicTime}
            defaultNightTime={logbookDefaultNightTime}
            defaultInstrumentTime={logbookDefaultInstrumentTime}
            defaultRemarks={logbookDefaultRemarks}
            hasLogbookEntry={hasLogbookEntry}
          />
        </CardContent>
      </Card>

      <Card id="costs">
        <CardHeader>
          <p className="text-sm text-slate-400">Costs & receipts</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div id="add-costs">
              <p className="text-xs uppercase text-slate-400">Add cost item</p>
              <CostItemForm
                action={`/api/flights/${flight.id}/cost-items/create`}
                submitLabel="Save cost item"
                pendingText="Saving cost item..."
                defaultValues={{
                  category: "",
                  amount: "",
                  date: flight.startTime.toISOString().slice(0, 10),
                  vendor: "",
                  notes: ""
                }}
              />
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Cost items</p>
              <div className="mt-3 space-y-3">
                {flight.costItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                    No cost items yet.
                  </div>
                ) : (
                  flight.costItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-800 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">
                            {getCostCategoryLabel(item.category)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.vendor ?? "Vendor not listed"} ·{" "}
                            {item.date.toDateString()}
                          </p>
                          {item.rateCents !== null && item.quantityHours !== null ? (
                            <p className="text-xs text-slate-400">
                              {currencyFormatter.format(item.rateCents / 100)} / hr ·{" "}
                              {formatDecimalInput(item.quantityHours)} hrs
                            </p>
                          ) : null}
                          {item.fuelGallons !== null && item.fuelPriceCents !== null ? (
                            <p className="text-xs text-slate-400">
                              {formatDecimalInput(item.fuelGallons)} gal ·{" "}
                              {currencyFormatter.format(item.fuelPriceCents / 100)} / gal
                            </p>
                          ) : null}
                          <p className="text-sm text-slate-300">
                            {item.notes ?? "No notes"}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <p className="text-sm font-semibold text-slate-100">
                            {currencyFormatter.format(item.amountCents / 100)}
                          </p>
                          <form
                            action={`/api/flights/${flight.id}/cost-items/delete`}
                            method="post"
                          >
                            <input type="hidden" name="costItemId" value={item.id} />
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
                      <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/30 px-4 py-3">
                        <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-400">
                          Edit cost item
                        </summary>
                        <CostItemForm
                          action={`/api/flights/${flight.id}/cost-items/create`}
                          submitLabel="Update cost item"
                          pendingText="Updating..."
                          submitSize="sm"
                          defaultValues={{
                            costItemId: item.id,
                            category: item.category,
                            amount: formatCurrencyInput(item.amountCents),
                            date: item.date.toISOString().slice(0, 10),
                            vendor: item.vendor ?? "",
                            notes: item.notes ?? "",
                            rate: formatCurrencyInput(item.rateCents),
                            quantityHours: formatDecimalInput(item.quantityHours),
                            fuelGallons: formatDecimalInput(item.fuelGallons),
                            fuelPrice: formatCurrencyInput(item.fuelPriceCents)
                          }}
                        />
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Receipts</p>
              <form method="get" className="mt-3 flex flex-wrap items-center gap-3">
                {selectedParticipantId ? (
                  <input
                    type="hidden"
                    name="participantId"
                    value={selectedParticipantId}
                  />
                ) : null}
                <label
                  htmlFor="receipt-cost-filter"
                  className="text-xs font-semibold uppercase text-slate-400"
                >
                  Filter by cost item
                </label>
                <select
                  id="receipt-cost-filter"
                  name="receiptCostItemId"
                  defaultValue={receiptFilter}
                  className="h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="all">All receipts</option>
                  <option value="unassigned">Unassigned</option>
                  {flight.costItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.category} · {currencyFormatter.format(item.amountCents / 100)}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  Apply filter
                </Button>
              </form>
              <form
                action={`/api/flights/${flight.id}/receipts/upload`}
                method="post"
                encType="multipart/form-data"
                className="mt-4 grid gap-3 lg:grid-cols-3"
              >
                <select
                  name="costItemId"
                  defaultValue={receiptUploadDefaultCostItemId}
                  className="h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Link to cost item (optional)</option>
                  {flight.costItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.category} · {currencyFormatter.format(item.amountCents / 100)}
                    </option>
                  ))}
                </select>
                <Input
                  id="receipt-upload"
                  name="receipts"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  multiple
                  required
                  className="lg:col-span-2"
                />
                <div className="lg:col-span-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <FormSubmitButton type="submit" pendingText="Uploading...">
                    Upload receipts
                  </FormSubmitButton>
                  <span>PDF, JPG, PNG up to 10MB each.</span>
                </div>
              </form>

              {receiptDocuments.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="h-6 w-6" />}
                  title={
                    flight.receiptDocuments.length === 0
                      ? "No receipts uploaded"
                      : "No receipts match this filter"
                  }
                  description={
                    flight.receiptDocuments.length === 0
                      ? "Upload receipts to keep every expense attached to this flight."
                      : "Try a different cost item filter or upload more receipts."
                  }
                  action={
                    <Button asChild>
                      <label htmlFor="receipt-upload">Upload receipts</label>
                    </Button>
                  }
                  secondaryAction={
                    <Button variant="outline" asChild>
                      <Link href="#add-costs">Add a cost item</Link>
                    </Button>
                  }
                  className="mt-4"
                />
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Filename</th>
                        <th className="px-4 py-3 text-left font-medium">Cost item</th>
                        <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                        <th className="px-4 py-3 text-left font-medium">Size</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {receiptDocuments.map((receipt) => (
                        <tr key={receipt.id} className="text-slate-200">
                          <td className="px-4 py-3">{receipt.originalFilename}</td>
                          <td className="px-4 py-3 text-slate-400">
                            {receiptCostItemLabel(receipt)}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {receipt.createdAt.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {formatBytes(receipt.sizeBytes ?? null)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/api/receipts/${receipt.id}/download`}>
                                  Download
                                </Link>
                              </Button>
                              <form action={`/api/receipts/${receipt.id}/delete`} method="post">
                                <FormSubmitButton
                                  size="sm"
                                  variant="outline"
                                  type="submit"
                                  pendingText="Deleting..."
                                >
                                  Delete
                                </FormSubmitButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
