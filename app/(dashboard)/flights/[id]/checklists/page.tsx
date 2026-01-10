import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChecklistSection } from "@/app/components/flights/checklist-section";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";

export default async function FlightChecklistsPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      checklistRuns: { include: { items: { orderBy: { order: "asc" } } } }
    }
  });

  if (!flight) {
    notFound();
  }

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">Checklists</h2>
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
          <p className="text-sm text-slate-400">Pre-flight & post-flight</p>
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
    </div>
  );
}

