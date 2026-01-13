import { FlightParticipantRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { handleApiError } from "@/src/lib/security/errors";
import {
  normalizePersonParticipants,
  parsePersonParticipantFormData
} from "@/app/lib/flights/participants";

const schema = z.object({
  tailNumber: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().optional(),
  aircraftId: z.string().optional(),
  unassigned: z.string().optional(),
  plannedStartTime: z.string().optional(),
  plannedEndTime: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  stopLabel: z.union([z.string(), z.array(z.string())]).optional(),
  selfRole: z.string().optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const csrf = validateRequestCsrf(request);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 400 });
    }

    const { user, session } = await getCurrentUser();
    if (!user || !session || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid flight update." }, { status: 400 });
    }

    const flight = await prisma.flight.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true }
    });
    if (!flight) {
      return NextResponse.json({ error: "Flight not found." }, { status: 404 });
    }

    const tailNumber = parsed.data.tailNumber.trim();
    const origin = parsed.data.origin.trim();
    const destination = parsed.data.destination?.trim() || null;

    const wantsUnassigned = parsed.data.unassigned === "on";
    const aircraftId = wantsUnassigned ? null : (parsed.data.aircraftId?.trim() || null);

    const plannedStartTime = parsed.data.plannedStartTime ? new Date(String(parsed.data.plannedStartTime)) : null;
    const plannedEndTime = parsed.data.plannedEndTime ? new Date(String(parsed.data.plannedEndTime)) : null;
    const startTime = parsed.data.startTime ? new Date(String(parsed.data.startTime)) : null;
    const endTime = parsed.data.endTime ? new Date(String(parsed.data.endTime)) : null;

    const normalizeDate = (d: Date | null) =>
      d && !Number.isNaN(d.getTime()) ? d : null;

    const stopLabelsRaw = parsed.data.stopLabel;
    const stopLabels = (Array.isArray(stopLabelsRaw) ? stopLabelsRaw : stopLabelsRaw ? [stopLabelsRaw] : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 8);

    const personParticipantInputs = normalizePersonParticipants(
      parsePersonParticipantFormData(formData)
    );
    const selfRoleRaw = String(formData.get("selfRole") ?? "PIC").trim().toUpperCase();
    const allowedSelfRoles = new Set<FlightParticipantRole>([
      "PIC",
      "SIC",
      "INSTRUCTOR",
      "STUDENT",
      "PASSENGER"
    ]);
    const selfRole = allowedSelfRoles.has(selfRoleRaw as FlightParticipantRole)
      ? (selfRoleRaw as FlightParticipantRole)
      : "PIC";

    // Validate people belong to current user.
    if (personParticipantInputs.length > 0) {
      const ids = personParticipantInputs.map((p) => p.personId);
      const found = await prisma.person.findMany({
        where: { userId: user.id, id: { in: ids } },
        select: { id: true }
      });
      const foundSet = new Set(found.map((p) => p.id));
      const missing = ids.filter((id) => !foundSet.has(id));
      if (missing.length > 0) {
        return NextResponse.json({ error: "One or more selected people were not found." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.flight.update({
        where: { id: flight.id },
        data: {
          tailNumber,
          tailNumberSnapshot: tailNumber,
          aircraftId,
          origin,
          destination,
          plannedStartTime: normalizeDate(plannedStartTime),
          plannedEndTime: normalizeDate(plannedEndTime),
          startTime: normalizeDate(startTime) ?? undefined,
          endTime: normalizeDate(endTime) ?? undefined
        }
      });

      await tx.flightStop.deleteMany({ where: { flightId: flight.id } });
      if (stopLabels.length > 0) {
        await tx.flightStop.createMany({
          data: stopLabels.map((label, idx) => ({
            flightId: flight.id,
            order: idx + 1,
            label,
            airportId: null
          }))
        });
      }

      // Replace participants (keep current user as PIC).
      await tx.flightParticipant.deleteMany({ where: { flightId: flight.id } });
      await tx.flightParticipant.createMany({
        data: [{ flightId: flight.id, userId: user.id, role: selfRole }]
      });

      await tx.flightPersonParticipant.deleteMany({ where: { flightId: flight.id } });
      if (personParticipantInputs.length > 0) {
        await tx.flightPersonParticipant.createMany({
          data: personParticipantInputs.map((p) => ({
            flightId: flight.id,
            personId: p.personId,
            role: p.role
          }))
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "flight.update");
  }
}

