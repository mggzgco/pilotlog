import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot } from "@/app/lib/checklists/snapshot";
import { recordAuditEvent } from "@/app/lib/audit";
import {
  normalizeParticipants,
  normalizePersonParticipants,
  parseParticipantFormData,
  parsePersonParticipantFormData
} from "@/app/lib/flights/participants";

const plannedFlightSchema = z.object({
  aircraftId: z.string().min(1),
  plannedStartTime: z.string().min(1),
  plannedEndTime: z.string().optional(),
  origin: z.string().min(1),
  destination: z.string().min(1)
});

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid planned flight details." }, { status: 400 });
  }

  const plannedStart = new Date(parsed.data.plannedStartTime);
  const plannedEnd = parsed.data.plannedEndTime
    ? new Date(parsed.data.plannedEndTime)
    : null;

  if (Number.isNaN(plannedStart.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled start time." }, { status: 400 });
  }

  if (plannedEnd && Number.isNaN(plannedEnd.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled end time." }, { status: 400 });
  }

  if (plannedEnd && plannedEnd < plannedStart) {
    return NextResponse.json(
      { error: "Scheduled end time cannot be earlier than start time." },
      { status: 400 }
    );
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: parsed.data.aircraftId, userId: user.id },
    select: { id: true, tailNumber: true }
  });

  if (!aircraft) {
    return NextResponse.json({ error: "Selected aircraft was not found." }, { status: 404 });
  }

  const participantInputs = normalizeParticipants(
    user.id,
    parseParticipantFormData(formData)
  );
  const personParticipantInputs = normalizePersonParticipants(
    parsePersonParticipantFormData(formData)
  );

  const flight = await prisma.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        userId: user.id,
        tailNumber: aircraft.tailNumber,
        tailNumberSnapshot: aircraft.tailNumber,
        aircraftId: aircraft.id,
        origin: parsed.data.origin.trim(),
        destination: parsed.data.destination.trim(),
        plannedStartTime: plannedStart,
        plannedEndTime: plannedEnd,
        startTime: plannedStart,
        status: "PLANNED",
        participants: {
          create: [
            { userId: user.id, role: "PIC" },
            ...participantInputs.map((participant) => ({
              userId: participant.userId,
              role: participant.role
            }))
          ]
        },
        peopleParticipants: {
          create: personParticipantInputs.map((participant) => ({
            personId: participant.personId,
            role: participant.role
          }))
        }
      }
    });

    const [preflightTemplate, postflightTemplate] = await Promise.all([
      selectChecklistTemplate({
        userId: user.id,
        aircraftId: aircraft.id,
        phase: "PREFLIGHT",
        client: tx
      }),
      selectChecklistTemplate({
        userId: user.id,
        aircraftId: aircraft.id,
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
      aircraftId: aircraft.id,
      tailNumber: aircraft.tailNumber,
      plannedStartTime: plannedStart.toISOString(),
      plannedEndTime: plannedEnd?.toISOString() ?? null
    }
  });

  return NextResponse.json({ flightId: flight.id }, { status: 201 });
}
