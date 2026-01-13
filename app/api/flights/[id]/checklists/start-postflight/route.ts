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
  redirectUrl.searchParams.set("tab", "postflight");
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      endTime: true,
      aircraftId: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      statsJson: true,
      aircraft: {
        select: {
          postflightChecklistTemplateId: true,
          aircraftType: { select: { defaultPostflightTemplateId: true } }
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
  // This keeps pre/post-flight checklist assignment consistent with the flight details page.
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
    typeof overrides.postflightTemplateId === "string" ? overrides.postflightTemplateId : null;

  const assignedPostflightTemplateId =
    flight.aircraft?.postflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPostflightTemplateId ??
    null;
  if (!assignedPostflightTemplateId) {
    redirectUrl.searchParams.set(
      "toast",
      "No post-flight checklist assigned to this aircraft."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const postflightRun = flight.checklistRuns.find(
    (run) => run.phase === "POSTFLIGHT"
  );
  const preflightRun = flight.checklistRuns.find(
    (run) => run.phase === "PREFLIGHT"
  );

  if (postflightRun && postflightRun.status !== "NOT_AVAILABLE") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist already started.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const canStart =
    preflightRun?.status === "SIGNED" ||
    flight.status === "COMPLETED" ||
    Boolean(flight.endTime);

  if (!canStart) {
    redirectUrl.searchParams.set(
      "toast",
      "Pre-flight checklist must be signed before starting post-flight."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const template =
    overrideTemplateId
      ? await prisma.checklistTemplate.findFirst({
          where: { id: overrideTemplateId, userId: user.id, phase: "POSTFLIGHT" },
          include: { items: { orderBy: { personalOrder: "asc" } } }
        })
      : await selectChecklistTemplate({
          userId: user.id,
          aircraftId,
          phase: "POSTFLIGHT"
        });
  if (!template || template.items.length === 0) {
    redirectUrl.searchParams.set("toast", "Post-flight checklist template has no items.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (!postflightRun) {
        await createChecklistRunSnapshot({
          client: tx,
          flightId: flight.id,
          phase: "POSTFLIGHT",
          status: "IN_PROGRESS",
          startedAt: now,
          template
        });
      } else {
        if (postflightRun.status === "SIGNED") {
          throw new Error("Post-flight checklist already signed.");
        }

        const completedCount = await tx.flightChecklistItem.count({
          where: {
            checklistRunId: postflightRun.id,
            kind: "STEP",
            completed: true
          }
        });

        const treatAsNotStarted = flight.status === "PLANNED" && completedCount === 0;
        if (postflightRun.startedAt && !treatAsNotStarted) {
          throw new Error("Post-flight checklist already started.");
        }

        if (treatAsNotStarted) {
          await replaceChecklistRunItems({
            client: tx,
            checklistRunId: postflightRun.id,
            template
          });
        }

        await tx.flightChecklistRun.update({
          where: { id: postflightRun.id },
          data: { status: "IN_PROGRESS", startedAt: now }
        });
      }

      await tx.flight.update({
        where: { id: flight.id },
        data: { status: "POSTFLIGHT_IN_PROGRESS" }
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start post-flight checklist.";
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("toast", "Post-flight checklist started.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
