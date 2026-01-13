import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChecklistSection } from "@/app/components/flights/checklist-section";
import { FlightStatusBadge } from "@/app/components/flights/flight-status-badge";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot } from "@/app/lib/checklists/snapshot";

export default async function FlightChecklistsPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const user = await requireUser();

  const baseSelect = {
    where: { id: params.id, userId: user.id },
    include: {
      aircraft: {
        include: {
          aircraftType: {
            select: { defaultPreflightTemplateId: true, defaultPostflightTemplateId: true }
          }
        }
      },
      checklistRuns: { include: { items: { orderBy: { personalOrder: "asc" } } } }
    }
  } as const;

  let flight = await prisma.flight.findFirst(baseSelect);

  if (!flight) {
    notFound();
  }
  let flightData = flight as NonNullable<typeof flight>;

  // Auto-link aircraft by tail number if missing. This keeps checklist availability
  // consistent even for flights imported before aircraft was created/linked.
  if (!flightData.aircraftId) {
    const tail = (flightData.tailNumberSnapshot ?? flightData.tailNumber ?? "").trim();
    if (tail) {
      const aircraft = await prisma.aircraft.findFirst({
        where: { userId: user.id, tailNumber: { equals: tail, mode: "insensitive" } },
        select: { id: true }
      });
      if (aircraft) {
        await prisma.flight.update({
          where: { id: flightData.id },
          data: { aircraftId: aircraft.id }
        });
        flight = (await prisma.flight.findFirst(baseSelect))!;
        flightData = flight as NonNullable<typeof flight>;
      }
    }
  }

  const defaultSignatureName =
    (user as any).name ||
    (user as any).email ||
    "Pilot";

  type ChecklistRun = NonNullable<typeof flight>["checklistRuns"][number];
  const toChecklistRunView = (run: ChecklistRun) => ({
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
      kind: item.kind,
      parentId: item.parentId,
      officialOrder: item.officialOrder,
      personalOrder: item.personalOrder,
      title: item.title,
      itemLabel: item.itemLabel,
      acceptanceCriteria: item.acceptanceCriteria,
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

  const assignedPreflightTemplateId =
    flightData.aircraft?.preflightChecklistTemplateId ??
    flightData.aircraft?.aircraftType?.defaultPreflightTemplateId ??
    null;
  const assignedPostflightTemplateId =
    flightData.aircraft?.postflightChecklistTemplateId ??
    flightData.aircraft?.aircraftType?.defaultPostflightTemplateId ??
    null;

  // Ensure checklist runs exist (older flights may not have snapshots until first start).
  if (
    flightData.aircraftId &&
    ((assignedPreflightTemplateId &&
      !flightData.checklistRuns.some((r) => r.phase === "PREFLIGHT")) ||
      (assignedPostflightTemplateId &&
        !flightData.checklistRuns.some((r) => r.phase === "POSTFLIGHT")))
  ) {
    await prisma.$transaction(async (tx) => {
      if (
        assignedPreflightTemplateId &&
        !flightData.checklistRuns.some((r) => r.phase === "PREFLIGHT")
      ) {
        const template = await selectChecklistTemplate({
          userId: user.id,
          aircraftId: flightData.aircraftId,
          phase: "PREFLIGHT",
          client: tx
        });
        if (template && template.items.length > 0) {
          await createChecklistRunSnapshot({
            client: tx,
            flightId: flightData.id,
            phase: "PREFLIGHT",
            status: "NOT_AVAILABLE",
            startedAt: null,
            template
          });
        }
      }
      if (
        assignedPostflightTemplateId &&
        !flightData.checklistRuns.some((r) => r.phase === "POSTFLIGHT")
      ) {
        const template = await selectChecklistTemplate({
          userId: user.id,
          aircraftId: flightData.aircraftId,
          phase: "POSTFLIGHT",
          client: tx
        });
        if (template && template.items.length > 0) {
          await createChecklistRunSnapshot({
            client: tx,
            flightId: flightData.id,
            phase: "POSTFLIGHT",
            status: "NOT_AVAILABLE",
            startedAt: null,
            template
          });
        }
      }
    });

    // Re-fetch after creating snapshots so the UI can show Start/Skip.
    flight = (await prisma.flight.findFirst(baseSelect))!;
    flightData = flight as NonNullable<typeof flight>;
  }

  const preflightRun = assignedPreflightTemplateId
    ? flightData.checklistRuns.find((run) => run.phase === "PREFLIGHT") ?? null
    : null;
  const postflightRun = assignedPostflightTemplateId
    ? flightData.checklistRuns.find((run) => run.phase === "POSTFLIGHT") ?? null
    : null;

  const defaultTab =
    typeof searchParams?.tab === "string" && searchParams.tab.toLowerCase() === "postflight"
      ? "POSTFLIGHT"
      : "PREFLIGHT";

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
            defaultTab={defaultTab}
            preflightRun={preflightRun ? toChecklistRunView(preflightRun) : null}
            postflightRun={postflightRun ? toChecklistRunView(postflightRun) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

