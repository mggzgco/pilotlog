import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot } from "@/app/lib/checklists/snapshot";
import { recordAuditEvent } from "@/app/lib/audit";
import { normalizeParticipants, parseParticipantFormData } from "@/app/lib/flights/participants";

const plannedFlightSchema = z.object({
  tailNumber: z.string().optional(),
  aircraftId: z.string().optional(),
  unassigned: z.string().optional(),
  plannedStartTime: z.string().optional(),
  plannedEndTime: z.string().optional(),
  departureLabel: z.string().optional(),
  arrivalLabel: z.string().optional()
});

export async function POST(request: Request) {
  const user = await requireUser();
  const redirectUrl = new URL("/flights/new", request.url);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSchema.safeParse(raw);
  if (!parsed.success) {
    redirectUrl.searchParams.set("toast", "Invalid planned flight details.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const tailNumberInput = String(parsed.data.tailNumber ?? "").trim();
  const aircraftId = parsed.data.aircraftId ? String(parsed.data.aircraftId) : null;
  const unassigned = parsed.data.unassigned === "on";

  if (!aircraftId && !unassigned) {
    redirectUrl.searchParams.set(
      "toast",
      "Select an aircraft or confirm the flight is unassigned."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  let tailNumber = tailNumberInput;
  if (aircraftId) {
    const aircraft = await prisma.aircraft.findFirst({
      where: { id: aircraftId, userId: user.id },
      select: { tailNumber: true }
    });
    if (!aircraft) {
      redirectUrl.searchParams.set("toast", "Selected aircraft was not found.");
      redirectUrl.searchParams.set("toastType", "error");
      return NextResponse.redirect(redirectUrl);
    }
    tailNumber = aircraft.tailNumber;
  }

  if (!tailNumber) {
    redirectUrl.searchParams.set("toast", "Tail number is required.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const plannedStart = parsed.data.plannedStartTime
    ? new Date(String(parsed.data.plannedStartTime))
    : null;
  const plannedEnd = parsed.data.plannedEndTime
    ? new Date(String(parsed.data.plannedEndTime))
    : null;

  if (plannedStart && Number.isNaN(plannedStart.getTime())) {
    redirectUrl.searchParams.set("toast", "Invalid planned start time.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (plannedEnd && Number.isNaN(plannedEnd.getTime())) {
    redirectUrl.searchParams.set("toast", "Invalid planned end time.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const departureLabel = String(parsed.data.departureLabel ?? "").trim();
  const arrivalLabel = String(parsed.data.arrivalLabel ?? "").trim();
  const startTime = plannedStart ?? new Date();
  const participantInputs = normalizeParticipants(
    user.id,
    parseParticipantFormData(formData)
  );

  const flight = await prisma.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        userId: user.id,
        tailNumber,
        tailNumberSnapshot: tailNumber,
        aircraftId,
        origin: departureLabel || "TBD",
        destination: arrivalLabel || null,
        plannedStartTime: plannedStart,
        plannedEndTime: plannedEnd,
        startTime,
        status: "PLANNED",
        participants: {
          create: [
            { userId: user.id, role: "PIC" },
            ...participantInputs.map((participant) => ({
              userId: participant.userId,
              role: participant.role
            }))
          ]
        }
      }
    });

    const [preflightTemplate, postflightTemplate] = await Promise.all([
      selectChecklistTemplate({
        userId: user.id,
        aircraftId,
        tailNumber,
        phase: "PREFLIGHT",
        client: tx
      }),
      selectChecklistTemplate({
        userId: user.id,
        aircraftId,
        tailNumber,
        phase: "POSTFLIGHT",
        client: tx
      })
    ]);

    await createChecklistRunSnapshot({
      client: tx,
      flightId: created.id,
      phase: "PREFLIGHT",
      status: "IN_PROGRESS",
      startedAt: new Date(),
      template: preflightTemplate
    });

    await createChecklistRunSnapshot({
      client: tx,
      flightId: created.id,
      phase: "POSTFLIGHT",
      status: "NOT_AVAILABLE",
      startedAt: null,
      template: postflightTemplate
    });

    return created;
  });

  await recordAuditEvent({
    userId: user.id,
    action: "flight.plan.created",
    entityType: "Flight",
    entityId: flight.id,
    metadata: {
      aircraftId,
      tailNumber,
      plannedStartTime: plannedStart?.toISOString() ?? null,
      plannedEndTime: plannedEnd?.toISOString() ?? null
    }
  });

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Planned flight created.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
