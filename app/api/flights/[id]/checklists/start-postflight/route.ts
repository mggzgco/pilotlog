import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot, replaceChecklistRunItems } from "@/app/lib/checklists/snapshot";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = new URL(`/flights/${params.id}/checklists`, request.url);
  redirectUrl.searchParams.set("tab", "postflight");
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      endTime: true,
      aircraftId: true,
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

  if (!postflightRun) {
    redirectUrl.searchParams.set("toast", "Post-flight checklist not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (postflightRun.status !== "NOT_AVAILABLE") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist already started.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const canStart =
    (preflightRun?.status === "SIGNED" && preflightRun.decision !== "REJECTED") ||
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
          aircraftId: flight.aircraftId,
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
