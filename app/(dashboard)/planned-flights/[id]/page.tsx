import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";
import {
  manualAdsbAssociationAction,
  postflightSignoffAction,
  preflightSignoffAction,
  selectAdsbCandidateAction,
  startPostflightAction,
  toggleChecklistItemAction
} from "@/app/lib/actions/planned-flight-actions";
import { createLogbookEntryForFlightAction } from "@/app/lib/actions/logbook-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

function formatDateTime(value?: Date | string | null) {
  if (!value) return "TBD";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

export default async function PlannedFlightDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: params.id },
    include: {
      checklistItems: { orderBy: { order: "asc" } },
      flight: true
    }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    notFound();
  }

  const preflightItems = plannedFlight.checklistItems.filter(
    (item) => item.type === "PREFLIGHT"
  );
  const postflightItems = plannedFlight.checklistItems.filter(
    (item) => item.type === "POSTFLIGHT"
  );
  const preflightComplete = preflightItems.every(
    (item) => !item.required || item.completedAt
  );
  const postflightComplete = postflightItems.every(
    (item) => !item.required || item.completedAt
  );

  const adsbCandidates = Array.isArray(plannedFlight.adsbCandidates)
    ? plannedFlight.adsbCandidates
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Planned flight</h2>
        <p className="text-sm text-slate-400">
          Tail {plannedFlight.tailNumber} · Planned {formatDateTime(plannedFlight.plannedAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Pre-flight checklist</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* CHK-002: associate a pre-flight checklist with each planned flight */}
          {preflightItems.map((item) => (
            <form
              key={item.id}
              action={toggleChecklistItemAction}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 p-3"
            >
              <div>
                <p className="font-medium text-slate-200">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.required ? "Required" : "Optional"} ·
                  {item.completedAt ? " Complete" : " Incomplete"}
                </p>
              </div>
              <input type="hidden" name="itemId" value={item.id} />
              <input
                type="hidden"
                name="completed"
                value={item.completedAt ? "false" : "true"}
              />
              <Button type="submit" variant="secondary">
                {item.completedAt ? "Undo" : "Mark complete"}
              </Button>
            </form>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <form action={preflightSignoffAction}>
              <input type="hidden" name="plannedFlightId" value={plannedFlight.id} />
              <Button
                type="submit"
                disabled={!preflightComplete || !!plannedFlight.preflightSignedAt}
              >
                {plannedFlight.preflightSignedAt ? "Pre-flight signed" : "Sign pre-flight"}
              </Button>
            </form>
            {plannedFlight.preflightSignedAt && (
              <p className="text-xs text-slate-400">
                Signed {formatDateTime(plannedFlight.preflightSignedAt)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Post-flight checklist</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!plannedFlight.preflightSignedAt && (
            <p className="text-sm text-slate-500">
              Complete and sign pre-flight before starting post-flight.
            </p>
          )}
          {plannedFlight.preflightSignedAt && !plannedFlight.postflightStartedAt && (
            <form action={startPostflightAction}>
              <input type="hidden" name="plannedFlightId" value={plannedFlight.id} />
              <Button type="submit">Start post-flight checklist</Button>
            </form>
          )}
          {plannedFlight.postflightStartedAt && (
            <div className="space-y-3">
              {/* CHK-005: post-flight checklist available after flight completion */}
              {postflightItems.map((item) => (
                <form
                  key={item.id}
                  action={toggleChecklistItemAction}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 p-3"
                >
                  <div>
                    <p className="font-medium text-slate-200">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.required ? "Required" : "Optional"} ·
                      {item.completedAt ? " Complete" : " Incomplete"}
                    </p>
                  </div>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input
                    type="hidden"
                    name="completed"
                    value={item.completedAt ? "false" : "true"}
                  />
                  <Button type="submit" variant="secondary">
                    {item.completedAt ? "Undo" : "Mark complete"}
                  </Button>
                </form>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <form action={postflightSignoffAction}>
                  <input
                    type="hidden"
                    name="plannedFlightId"
                    value={plannedFlight.id}
                  />
                  <Button
                    type="submit"
                    disabled={!postflightComplete || !!plannedFlight.postflightSignedAt}
                  >
                    {plannedFlight.postflightSignedAt
                      ? "Post-flight signed"
                      : "Sign post-flight"}
                  </Button>
                </form>
                {plannedFlight.postflightSignedAt && (
                  <p className="text-xs text-slate-400">
                    Signed {formatDateTime(plannedFlight.postflightSignedAt)}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">ADS-B association</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            Status: <span className="font-semibold">{plannedFlight.adsbMatchStatus}</span>
          </p>
          {plannedFlight.adsbMatchStatus === "MATCHED" && plannedFlight.flight && (
            <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
              <p className="font-semibold">
                {plannedFlight.flight.origin} → {plannedFlight.flight.destination ?? "TBD"}
              </p>
              <p className="text-xs text-slate-400">
                {formatDateTime(plannedFlight.flight.departAt)} · Duration{" "}
                {plannedFlight.flight.durationMins ?? "—"} mins
              </p>
            </div>
          )}

          {plannedFlight.adsbMatchStatus === "AMBIGUOUS" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Multiple ADS-B flights found. Select the best match.
              </p>
              {/* CHK-008: guide user to select a candidate */}
              {adsbCandidates.map((candidate, index) => (
                <form
                  key={`${candidate.tailNumber}-${index}`}
                  action={selectAdsbCandidateAction}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {candidate.origin} → {candidate.destination}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(candidate.departAt)} · {candidate.durationMins} mins
                    </p>
                  </div>
                  <input type="hidden" name="plannedFlightId" value={plannedFlight.id} />
                  <input type="hidden" name="tailNumber" value={candidate.tailNumber} />
                  <input type="hidden" name="origin" value={candidate.origin} />
                  <input type="hidden" name="destination" value={candidate.destination} />
                  <input type="hidden" name="departAt" value={candidate.departAt} />
                  <input type="hidden" name="arriveAt" value={candidate.arriveAt} />
                  <input type="hidden" name="durationMins" value={candidate.durationMins} />
                  <input type="hidden" name="distanceNm" value={candidate.distanceNm} />
                  <input type="hidden" name="routePolyline" value={candidate.routePolyline} />
                  <Button type="submit" variant="secondary">
                    Select
                  </Button>
                </form>
              ))}
            </div>
          )}

          {(plannedFlight.adsbMatchStatus === "MISSING" ||
            plannedFlight.adsbMatchStatus === "AMBIGUOUS") && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                If needed, manually import the flight details below.
              </p>
              <form
                action={manualAdsbAssociationAction}
                className="grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="plannedFlightId" value={plannedFlight.id} />
                <Input name="tailNumber" defaultValue={plannedFlight.tailNumber} required />
                <Input name="origin" placeholder="Origin" required />
                <Input name="destination" placeholder="Destination" />
                <Input name="departAt" type="datetime-local" required />
                <Input name="arriveAt" type="datetime-local" required />
                <Input name="durationMins" placeholder="Duration (mins)" />
                <Input name="distanceNm" placeholder="Distance (nm)" />
                <Input
                  name="routePolyline"
                  placeholder="Route polyline"
                  className="md:col-span-3"
                />
                <div className="md:col-span-3">
                  <Button type="submit">Associate flight</Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {plannedFlight.flight && (
        <Card>
          <CardHeader>
            <p className="text-sm text-slate-400">Logbook entry</p>
          </CardHeader>
          <CardContent>
            {/* CHK-009: prompt logbook entry with prefilled values */}
            <form
              action={createLogbookEntryForFlightAction}
              className="grid gap-3 md:grid-cols-3"
            >
              <input type="hidden" name="flightId" value={plannedFlight.flight.id} />
              <Input
                name="date"
                type="date"
                defaultValue={plannedFlight.flight.departAt.toISOString().slice(0, 10)}
                required
              />
              <Input
                name="totalTime"
                defaultValue={
                  plannedFlight.flight.durationMins
                    ? (plannedFlight.flight.durationMins / 60).toFixed(1)
                    : ""
                }
                placeholder="Total time"
              />
              <Input name="picTime" placeholder="PIC time" />
              <Input name="sicTime" placeholder="SIC time" />
              <Input name="nightTime" placeholder="Night" />
              <Input name="instrumentTime" placeholder="Instrument" />
              <Input
                name="remarks"
                placeholder={`Flight ${plannedFlight.flight.origin} → ${
                  plannedFlight.flight.destination ?? "TBD"
                }`}
                className="md:col-span-2"
              />
              <div className="md:col-span-3">
                <Button type="submit">Save logbook entry</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
