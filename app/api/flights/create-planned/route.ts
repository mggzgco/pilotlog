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
import { lookupAirportByCode } from "@/app/lib/airports/lookup";

const plannedFlightSchema = z.object({
  tailNumber: z.string().optional(),
  aircraftId: z.string().optional(),
  unassigned: z.string().optional(),
  // legacy (datetime-local)
  plannedStartTime: z.string().optional(),
  plannedEndTime: z.string().optional(),
  // new (explicit 24h + timezone)
  timeZone: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedStartClock: z.string().optional(),
  plannedEndDate: z.string().optional(),
  plannedEndClock: z.string().optional(),
  departureLabel: z.string().optional(),
  arrivalLabel: z.string().optional()
});

function parseClockHHMM(value: string | null): { hour: number; minute: number } | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function getTimeZoneParts(date: Date, timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const parts = dtf.formatToParts(date);
    const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
      year: Number(byType.year),
      month: Number(byType.month),
      day: Number(byType.day),
      hour: Number(byType.hour),
      minute: Number(byType.minute),
      second: Number(byType.second)
    };
  } catch {
    return null;
  }
}

// Convert a local (date + HH:MM) in a specific IANA timezone to a UTC Date.
// This uses a small iterative correction to account for DST transitions.
function zonedLocalToUtc({
  dateStr,
  clock,
  timeZone
}: {
  dateStr: string;
  clock: { hour: number; minute: number };
  timeZone: string;
}): Date | null {
  const dateTrimmed = dateStr.trim();
  if (!dateTrimmed) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTrimmed);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const desiredLocalAsUtcMs = Date.UTC(year, month - 1, day, clock.hour, clock.minute, 0);
  let guessMs = desiredLocalAsUtcMs;

  for (let i = 0; i < 2; i += 1) {
    const guessDate = new Date(guessMs);
    const actual = getTimeZoneParts(guessDate, timeZone);
    if (!actual) return null;
    const actualLocalAsUtcMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const diffMs = desiredLocalAsUtcMs - actualLocalAsUtcMs;
    guessMs += diffMs;
  }

  const result = new Date(guessMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

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

  const fallbackTimeZone = String(parsed.data.timeZone ?? "").trim() || "UTC";

  const plannedStartClock = parseClockHHMM(
    parsed.data.plannedStartClock ? String(parsed.data.plannedStartClock) : null
  );
  const plannedEndClock = parseClockHHMM(
    parsed.data.plannedEndClock ? String(parsed.data.plannedEndClock) : null
  );

  // Legacy fallback (datetime-local)
  const plannedStartLegacy = parsed.data.plannedStartTime
    ? new Date(String(parsed.data.plannedStartTime))
    : null;
  const plannedEndLegacy = parsed.data.plannedEndTime
    ? new Date(String(parsed.data.plannedEndTime))
    : null;

  if ((parsed.data.plannedStartDate && !plannedStartClock) || (!parsed.data.plannedStartDate && plannedStartClock)) {
    redirectUrl.searchParams.set("toast", "Planned start requires both date and time (HH:MM).");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if ((parsed.data.plannedEndDate && !plannedEndClock) || (!parsed.data.plannedEndDate && plannedEndClock)) {
    redirectUrl.searchParams.set("toast", "Planned end requires both date and time (HH:MM).");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if (plannedStartLegacy && Number.isNaN(plannedStartLegacy.getTime())) {
    redirectUrl.searchParams.set("toast", "Invalid planned start time.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if (plannedEndLegacy && Number.isNaN(plannedEndLegacy.getTime())) {
    redirectUrl.searchParams.set("toast", "Invalid planned end time.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const departureLabel = String(parsed.data.departureLabel ?? "").trim();
  const arrivalLabel = String(parsed.data.arrivalLabel ?? "").trim();
  const stopLabelsRaw = formData.getAll("stopLabel").map((v) => String(v ?? "").trim());
  const stopLabels = stopLabelsRaw
    .map((v) => v.toUpperCase())
    .filter((v) => v.length > 0)
    .slice(0, 5);
  const [originAirport, destinationAirport] = await Promise.all([
    departureLabel ? lookupAirportByCode(departureLabel) : Promise.resolve(null),
    arrivalLabel ? lookupAirportByCode(arrivalLabel) : Promise.resolve(null)
  ]);

  const stopAirports = await Promise.all(stopLabels.map((label) => lookupAirportByCode(label)));

  const startTimeZone = originAirport?.timeZone ?? fallbackTimeZone;
  const endTimeZone = destinationAirport?.timeZone ?? startTimeZone;

  const plannedStartFromParts =
    parsed.data.plannedStartDate && plannedStartClock
      ? zonedLocalToUtc({
          dateStr: String(parsed.data.plannedStartDate),
          clock: plannedStartClock,
          timeZone: startTimeZone
        })
      : null;
  const plannedEndFromParts =
    parsed.data.plannedEndDate && plannedEndClock
      ? zonedLocalToUtc({
          dateStr: String(parsed.data.plannedEndDate),
          clock: plannedEndClock,
          timeZone: endTimeZone
        })
      : null;

  const plannedStart = plannedStartFromParts ?? plannedStartLegacy;
  const plannedEnd = plannedEndFromParts ?? plannedEndLegacy;

  if (parsed.data.plannedStartDate && plannedStartFromParts === null) {
    redirectUrl.searchParams.set(
      "toast",
      "Invalid planned start date/time for the departure airport time zone."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if (parsed.data.plannedEndDate && plannedEndFromParts === null) {
    redirectUrl.searchParams.set(
      "toast",
      "Invalid planned end date/time for the arrival airport time zone."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const startTime = plannedStart ?? new Date();
  const participantInputs = normalizeParticipants(
    user.id,
    parseParticipantFormData(formData)
  );
  const personParticipantInputs = normalizePersonParticipants(
    parsePersonParticipantFormData(formData)
  );

  // Ensure all person IDs belong to the current user.
  if (personParticipantInputs.length > 0) {
    const ids = personParticipantInputs.map((p) => p.personId);
    const found = await prisma.person.findMany({
      where: { userId: user.id, id: { in: ids } },
      select: { id: true }
    });
    const foundSet = new Set(found.map((p) => p.id));
    const missing = ids.filter((id) => !foundSet.has(id));
    if (missing.length > 0) {
      redirectUrl.searchParams.set("toast", "One or more selected people were not found.");
      redirectUrl.searchParams.set("toastType", "error");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const flight = await prisma.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        userId: user.id,
        tailNumber,
        tailNumberSnapshot: tailNumber,
        aircraftId,
        origin: departureLabel || "TBD",
        originAirportId: originAirport?.id ?? null,
        destination: arrivalLabel || null,
        destinationAirportId: destinationAirport?.id ?? null,
        stops: {
          create: stopLabels.map((label, idx) => ({
            order: idx + 1,
            label,
            airportId: stopAirports[idx]?.id ?? null
          }))
        },
        plannedStartTime: plannedStart,
        plannedEndTime: plannedEnd,
        startTime,
        status: "PLANNED",
        statsJson: {
          startTimeZone,
          endTimeZone
        },
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
        aircraftId,
        phase: "PREFLIGHT",
        client: tx
      }),
      selectChecklistTemplate({
        userId: user.id,
        aircraftId,
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
