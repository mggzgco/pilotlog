import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { LogbookEntryForm } from "@/app/components/flights/logbook-entry-form";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";

export default async function FlightLogbookPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { participantId?: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      logbookEntries: { select: { id: true } },
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
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

  const hasLogbookEntry = Boolean(logbookEntry);
  const hasAnyLogbookEntry = flight.logbookEntries.length > 0;
  const isImported = Boolean(
    flight.importedProvider ||
      flight.providerFlightId ||
      ["IMPORTED", "COMPLETED"].includes(flight.status)
  );
  const showLogbookPrompt = isImported && logbookEntry?.totalTime == null;
  const prefillPicTime =
    logbookEntry?.picTime?.toString() ??
    "";
  const prefillSicTime = logbookEntry?.sicTime?.toString() ?? "";

  const logbookDefaultDate = logbookEntry?.date
    ? logbookEntry.date.toISOString().slice(0, 10)
    : flight.startTime.toISOString().slice(0, 10);
  const logbookDefaultNightTime = logbookEntry?.nightTime?.toString() ?? "";
  const logbookDefaultXcTime = (logbookEntry as any)?.xcTime?.toString?.() ?? "";
  const logbookDefaultDualReceivedTime =
    (logbookEntry as any)?.dualReceivedTime?.toString?.() ?? "";
  const logbookDefaultSoloTime = (logbookEntry as any)?.soloTime?.toString?.() ?? "";
  const logbookDefaultSimulatedInstrumentTime =
    (logbookEntry as any)?.simulatedInstrumentTime?.toString?.() ?? "";
  const logbookDefaultInstrumentTime = logbookEntry?.instrumentTime?.toString() ?? "";
  const logbookDefaultSimulatorTime = (logbookEntry as any)?.simulatorTime?.toString?.() ?? "";
  const logbookDefaultGroundTime = (logbookEntry as any)?.groundTime?.toString?.() ?? "";
  const logbookDefaultTimeOut = (logbookEntry as any)?.timeOut ?? "";
  const logbookDefaultTimeIn = (logbookEntry as any)?.timeIn ?? "";
  const logbookDefaultHobbsOut = (logbookEntry as any)?.hobbsOut?.toString?.() ?? "";
  const logbookDefaultHobbsIn = (logbookEntry as any)?.hobbsIn?.toString?.() ?? "";
  const logbookDefaultTotalTime =
    (logbookEntry as any)?.totalTime?.toString?.() ??
    (() => {
      const out = Number(logbookDefaultHobbsOut);
      const inn = Number(logbookDefaultHobbsIn);
      if (!Number.isFinite(out) || !Number.isFinite(inn)) return "";
      const diff = inn - out;
      if (!Number.isFinite(diff) || diff < 0) return "";
      return (Math.round(diff * 10) / 10).toString();
    })();
  const logbookDefaultDayTakeoffs = (logbookEntry as any)?.dayTakeoffs?.toString?.() ?? "";
  const logbookDefaultDayLandings = (logbookEntry as any)?.dayLandings?.toString?.() ?? "";
  const logbookDefaultNightTakeoffs = (logbookEntry as any)?.nightTakeoffs?.toString?.() ?? "";
  const logbookDefaultNightLandings = (logbookEntry as any)?.nightLandings?.toString?.() ?? "";
  const logbookDefaultRemarks = logbookEntry?.remarks ?? "";
  const logbookDefaultStatus = logbookEntry?.status === "CLOSED" ? "CLOSED" : "OPEN";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">Logbook</h2>
            <FlightStatusBadge status={flight.status} />
          </div>
          <Button variant="outline" asChild>
            <Link href={`/flights/${flight.id}`}>Back to flight dashboard</Link>
          </Button>
        </div>
        <p className="text-sm text-slate-400">
          {flight.tailNumberSnapshot ?? flight.tailNumber} · {flight.origin} →{" "}
          {flight.destination ?? "TBD"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Logbook entry</p>
        </CardHeader>
        <CardContent>
          {showLogbookPrompt ? (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              This flight has ADS-B attached—log your time to finish it. Logbook time is
              independent from ADS-B.
            </div>
          ) : null}
          {!hasAnyLogbookEntry ? (
            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
              No logbook entries yet for this flight. Create one to track hours and notes.
            </div>
          ) : null}

          {participants.length > 1 ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Participant
                </label>
                <select
                  name="participantId"
                  defaultValue={selectedParticipant?.id ?? ""}
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
                View
              </Button>
            </form>
          ) : null}

          <LogbookEntryForm
            flightId={flight.id}
            participantId={selectedParticipant?.id ?? null}
            defaultStatus={logbookDefaultStatus}
            defaultDate={logbookDefaultDate}
            defaultTotalTime={logbookDefaultTotalTime}
            defaultPicTime={prefillPicTime}
            defaultSicTime={prefillSicTime}
            defaultDualReceivedTime={logbookDefaultDualReceivedTime}
            defaultSoloTime={logbookDefaultSoloTime}
            defaultNightTime={logbookDefaultNightTime}
            defaultXcTime={logbookDefaultXcTime}
            defaultSimulatedInstrumentTime={logbookDefaultSimulatedInstrumentTime}
            defaultInstrumentTime={logbookDefaultInstrumentTime}
            defaultSimulatorTime={logbookDefaultSimulatorTime}
            defaultGroundTime={logbookDefaultGroundTime}
            defaultTimeOut={logbookDefaultTimeOut}
            defaultTimeIn={logbookDefaultTimeIn}
            defaultHobbsOut={logbookDefaultHobbsOut}
            defaultHobbsIn={logbookDefaultHobbsIn}
            defaultDayTakeoffs={logbookDefaultDayTakeoffs}
            defaultDayLandings={logbookDefaultDayLandings}
            defaultNightTakeoffs={logbookDefaultNightTakeoffs}
            defaultNightLandings={logbookDefaultNightLandings}
            defaultRemarks={logbookDefaultRemarks}
            hasLogbookEntry={hasLogbookEntry}
          />
        </CardContent>
      </Card>
    </div>
  );
}

