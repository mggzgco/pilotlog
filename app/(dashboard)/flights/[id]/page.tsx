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

export default async function FlightDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      trackPoints: { orderBy: { recordedAt: "asc" } },
      logbookEntries: { orderBy: { date: "desc" } },
      costItems: { orderBy: { date: "desc" } },
      receiptDocuments: { orderBy: { createdAt: "desc" } },
      checklistRuns: {
        include: { items: { orderBy: { order: "asc" } } }
      }
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
  const showAutoImportSuccess = searchParams?.adsbImport === "matched";
  const showAutoImportMatchCta = flight.autoImportStatus === "AMBIGUOUS";
  const showAutoImportNotFound = flight.autoImportStatus === "NOT_FOUND";
  const showAutoImportFailed = flight.autoImportStatus === "FAILED";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Flight details</h2>
        <p className="text-sm text-slate-400">
          {flight.tailNumber} · {flight.origin} → {flight.destination ?? "TBD"}
        </p>
      </div>

      {showAutoImportSuccess ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          ADS-B data imported. Please complete your logbook entry.
        </div>
      ) : null}

      {showAutoImportNotFound ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
            defaultSignatureName={defaultSignatureName}
            preflightRun={preflightRun ? toChecklistRunView(preflightRun) : null}
            postflightRun={postflightRun ? toChecklistRunView(postflightRun) : null}
          />
        </CardContent>
      </Card>

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
              <FormSubmitButton type="submit" pendingText="Saving logbook...">
                Save logbook
              </FormSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Costs & receipts</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div id="add-costs">
              <p className="text-xs uppercase text-slate-400">Add cost item</p>
              <form
                action={`/api/flights/${flight.id}/cost-items/create`}
                method="post"
                className="mt-3 grid gap-3 md:grid-cols-3"
              >
                <Input name="category" placeholder="Category" required />
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  required
                />
                <Input
                  name="date"
                  type="date"
                  required
                  defaultValue={flight.startTime.toISOString().slice(0, 10)}
                />
                <Input name="vendor" placeholder="Vendor" />
                <Input
                  name="notes"
                  placeholder="Notes"
                  className="md:col-span-2"
                />
                <div className="md:col-span-3">
                  <FormSubmitButton type="submit" pendingText="Saving cost item...">
                    Save cost item
                  </FormSubmitButton>
                </div>
              </form>
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
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">
                            {item.category}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.vendor ?? "Vendor not listed"} ·{" "}
                            {item.date.toDateString()}
                          </p>
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
                        <form
                          action={`/api/flights/${flight.id}/cost-items/create`}
                          method="post"
                          className="mt-3 grid gap-3 md:grid-cols-3"
                        >
                          <input type="hidden" name="costItemId" value={item.id} />
                          <Input
                            name="category"
                            placeholder="Category"
                            defaultValue={item.category}
                            required
                          />
                          <Input
                            name="amount"
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            defaultValue={(item.amountCents / 100).toFixed(2)}
                            required
                          />
                          <Input
                            name="date"
                            type="date"
                            defaultValue={item.date.toISOString().slice(0, 10)}
                            required
                          />
                          <Input
                            name="vendor"
                            placeholder="Vendor"
                            defaultValue={item.vendor ?? ""}
                          />
                          <Input
                            name="notes"
                            placeholder="Notes"
                            className="md:col-span-2"
                            defaultValue={item.notes ?? ""}
                          />
                          <div className="md:col-span-3">
                            <FormSubmitButton
                              type="submit"
                              size="sm"
                              pendingText="Updating..."
                            >
                              Update cost item
                            </FormSubmitButton>
                          </div>
                        </form>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Receipts</p>
              <form
                action={`/api/flights/${flight.id}/receipts/upload`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 grid gap-3 md:grid-cols-3"
              >
                <Input
                  id="receipt-upload"
                  name="receipts"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  multiple
                  required
                  className="md:col-span-2"
                />
                <div className="md:col-span-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <FormSubmitButton type="submit" pendingText="Uploading...">
                    Upload receipts
                  </FormSubmitButton>
                  <span>PDF, JPG, PNG up to 10MB each.</span>
                </div>
              </form>

              {flight.receiptDocuments.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="h-6 w-6" />}
                  title="No receipts uploaded"
                  description="Upload receipts to keep every expense attached to this flight."
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
                        <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                        <th className="px-4 py-3 text-left font-medium">Size</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {flight.receiptDocuments.map((receipt) => (
                        <tr key={receipt.id} className="text-slate-200">
                          <td className="px-4 py-3">{receipt.originalFilename}</td>
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
