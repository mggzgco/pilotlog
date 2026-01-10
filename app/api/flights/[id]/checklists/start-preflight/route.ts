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
            select: { defaultPreflightTemplateId: true }
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

  if (!preflightRun) {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (preflightRun.status === "SIGNED") {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist already signed.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (preflightRun.startedAt) {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist already started.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  await prisma.flightChecklistRun.update({
    where: { id: preflightRun.id },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date()
    }
  });

  redirectUrl.searchParams.set("toast", "Pre-flight checklist started.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
