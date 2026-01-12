import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot, replaceChecklistRunItems } from "@/app/lib/checklists/snapshot";
import { buildRedirectUrl } from "@/app/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = buildRedirectUrl(request, `/flights/${params.id}/checklists`);
  redirectUrl.searchParams.set("tab", "preflight");
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      aircraftId: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      statsJson: true,
      aircraft: {
        select: {
          preflightChecklistTemplateId: true,
          aircraftType: { select: { defaultPreflightTemplateId: true } }
        }
      },
      checklistRuns: true
    }
  });

  if (!flight) {
    redirectUrl.searchParams.set("toast", "Flight not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  // If the flight isn't linked to an aircraft yet, try to auto-link by tail number.
  let aircraftId = flight.aircraftId;
  if (!aircraftId) {
    const tail = (flight.tailNumberSnapshot ?? flight.tailNumber ?? "").trim();
    if (tail) {
      const match = await prisma.aircraft.findFirst({
        where: { userId: user.id, tailNumber: { equals: tail, mode: "insensitive" } },
        select: { id: true }
      });
      if (match) {
        await prisma.flight.update({
          where: { id: flight.id },
          data: { aircraftId: match.id }
        });
        aircraftId = match.id;
      }
    }
  }

  const stats =
    flight.statsJson && typeof flight.statsJson === "object" && !Array.isArray(flight.statsJson)
      ? (flight.statsJson as Record<string, unknown>)
      : {};
  const overrides =
    stats.checklistTemplateOverrides &&
    typeof stats.checklistTemplateOverrides === "object" &&
    !Array.isArray(stats.checklistTemplateOverrides)
      ? (stats.checklistTemplateOverrides as Record<string, unknown>)
      : {};
  const overrideTemplateId =
    typeof overrides.preflightTemplateId === "string" ? overrides.preflightTemplateId : null;

  const assignedPreflightTemplateId =
    flight.aircraft?.preflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPreflightTemplateId ??
    null;
  if (!assignedPreflightTemplateId) {
    redirectUrl.searchParams.set(
      "toast",
      "No pre-flight checklist assigned to this aircraft."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const preflightRun = flight.checklistRuns.find((run) => run.phase === "PREFLIGHT");

  const template =
    overrideTemplateId
      ? await prisma.checklistTemplate.findFirst({
          where: { id: overrideTemplateId, userId: user.id, phase: "PREFLIGHT" },
          include: { items: { orderBy: { personalOrder: "asc" } } }
        })
      : await selectChecklistTemplate({
          userId: user.id,
          aircraftId,
          phase: "PREFLIGHT"
        });
  if (!template || template.items.length === 0) {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist template has no items.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (!preflightRun) {
        await createChecklistRunSnapshot({
          client: tx,
          flightId: flight.id,
          phase: "PREFLIGHT",
          status: "IN_PROGRESS",
          startedAt: now,
          template
        });
        return;
      }

      if (preflightRun.status === "SIGNED") {
        throw new Error("Pre-flight checklist already signed.");
      }

      const completedCount = await tx.flightChecklistItem.count({
        where: {
          checklistRunId: preflightRun.id,
          kind: "STEP",
          completed: true
        }
      });

      const treatAsNotStarted = flight.status === "PLANNED" && completedCount === 0;
      if (preflightRun.startedAt && !treatAsNotStarted) {
        throw new Error("Pre-flight checklist already started.");
      }

      // If the flight hasn't started (PLANNED + no items completed), always refresh the snapshot
      // so the checklist reflects the most current aircraft assignment.
      if (treatAsNotStarted) {
        await replaceChecklistRunItems({
          client: tx,
          checklistRunId: preflightRun.id,
          template
        });
      }

      await tx.flightChecklistRun.update({
        where: { id: preflightRun.id },
        data: { status: "IN_PROGRESS", startedAt: now }
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start pre-flight checklist.";
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("toast", "Pre-flight checklist started.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
