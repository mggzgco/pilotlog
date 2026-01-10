import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = new URL(`/flights/${params.id}`, request.url);
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      aircraft: {
        include: {
          aircraftType: {
            select: { defaultPostflightTemplateId: true }
          }
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
    flight.status === "COMPLETED";

  if (!canStart) {
    redirectUrl.searchParams.set(
      "toast",
      "Pre-flight checklist must be signed before starting post-flight."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  await prisma.$transaction(async (tx) => {
    await tx.flightChecklistRun.update({
      where: { id: postflightRun.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date()
      }
    });

    await tx.flight.update({
      where: { id: flight.id },
      data: { status: "POSTFLIGHT_IN_PROGRESS" }
    });
  });

  redirectUrl.searchParams.set("toast", "Post-flight checklist started.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
