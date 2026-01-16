import { FlightParticipantRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot } from "@/app/lib/checklists/snapshot";
import { recordAuditEvent } from "@/app/lib/audit";
import {
  normalizePersonParticipants,
  parsePersonParticipantFormData
} from "@/app/lib/flights/participants";
import { lookupAirportByCode } from "@/app/lib/airports/lookup";

const plannedFlightSchema = z.object({
  aircraftId: z.string().min(1),
  // Legacy (datetime-local)
  plannedStartTime: z.string().optional(),
  plannedEndTime: z.string().optional(),
  // New (explicit 24h + timezone)
  timeZone: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedStartClock: z.string().optional(),
  plannedEndDate: z.string().optional(),
  plannedEndClock: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  // Dashboard form uses departure/arrival labels; accept both.
  departureLabel: z.string().optional(),
  arrivalLabel: z.string().optional(),
  stopLabel: z.union([z.string(), z.array(z.string())]).optional(),
  selfRole: z.string().optional()
});

function parseClockHHMM(value: string | null): { hour: number; minute: number } | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  // 0630 -> 06:30
  const compact = /^(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) {
    const hour = Number(compact[1]);
    const minute = Number(compact[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }

  // 6:30, 06:30, 6.30, 6:30pm, 6:30 pm
  const hm = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i.exec(trimmed);
  if (hm) {
    let hour = Number(hm[1]);
    const minute = Number(hm[2]);
    const suffix = hm[3]?.toLowerCase() ?? null;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (minute < 0 || minute > 59) return null;
    if (suffix) {
      if (hour < 1 || hour > 12) return null;
      if (suffix === "am") hour = hour === 12 ? 0 : hour;
      if (suffix === "pm") hour = hour === 12 ? 12 : hour + 12;
    } else {
      if (hour < 0 || hour > 23) return null;
    }
    return { hour, minute };
  }

  return null;
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
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid planned flight details." }, { status: 400 });
  }

  const plannedStartLegacy = parsed.data.plannedStartTime
    ? new Date(String(parsed.data.plannedStartTime))
    : null;
  const plannedEndLegacy = parsed.data.plannedEndTime
    ? new Date(String(parsed.data.plannedEndTime))
    : null;

  if (plannedStartLegacy && Number.isNaN(plannedStartLegacy.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled start time." }, { status: 400 });
  }
  if (plannedEndLegacy && Number.isNaN(plannedEndLegacy.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled end time." }, { status: 400 });
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: parsed.data.aircraftId, userId: user.id },
    select: { id: true, tailNumber: true }
  });

  if (!aircraft) {
    return NextResponse.json({ error: "Selected aircraft was not found." }, { status: 404 });
  }

  const originInput =
    parsed.data.origin ?? parsed.data.departureLabel ?? "";
  const destinationInput =
    parsed.data.destination ?? parsed.data.arrivalLabel ?? "";
  const originLabelRaw = String(originInput).trim().toUpperCase();
  const destinationLabelRaw = String(destinationInput).trim().toUpperCase();
  const originLabel = originLabelRaw || "TBD";
  const destinationLabel = destinationLabelRaw || null;
  const stopLabels = (() => {
    const rawStops = parsed.data.stopLabel;
    const arr = Array.isArray(rawStops) ? rawStops : rawStops ? [rawStops] : [];
    return arr
      .map((s) => String(s).trim().toUpperCase())
      .filter((s) => s.length > 0)
      .slice(0, 5);
  })();

  const [originAirport, destinationAirport, ...stopAirports] = await Promise.all([
    originLabelRaw ? lookupAirportByCode(originLabelRaw) : Promise.resolve(null),
    destinationLabelRaw ? lookupAirportByCode(destinationLabelRaw) : Promise.resolve(null),
    ...stopLabels.map((s) => lookupAirportByCode(s))
  ]);

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { homeTimeZone: true }
  });

  const fallbackTimeZone =
    String(parsed.data.timeZone ?? "").trim() ||
    userProfile?.homeTimeZone ||
    "UTC";

  const plannedStartClock = parseClockHHMM(
    parsed.data.plannedStartClock ? String(parsed.data.plannedStartClock) : null
  );
  const plannedEndClock = parseClockHHMM(
    parsed.data.plannedEndClock ? String(parsed.data.plannedEndClock) : null
  );

  if (
    (parsed.data.plannedStartDate && !plannedStartClock) ||
    (!parsed.data.plannedStartDate && plannedStartClock)
  ) {
    return NextResponse.json(
      { error: "Scheduled start requires both date and time (HH:MM)." },
      { status: 400 }
    );
  }
  if ((parsed.data.plannedEndDate && !plannedEndClock) || (!parsed.data.plannedEndDate && plannedEndClock)) {
    return NextResponse.json(
      { error: "Scheduled end requires both date and time (HH:MM)." },
      { status: 400 }
    );
  }

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

  if (!plannedStart) {
    return NextResponse.json({ error: "Scheduled start time is required." }, { status: 400 });
  }
  if (plannedEnd && plannedEnd < plannedStart) {
    return NextResponse.json(
      { error: "Scheduled end time cannot be earlier than start time." },
      { status: 400 }
    );
  }
  if (parsed.data.plannedStartDate && plannedStartFromParts === null) {
    return NextResponse.json(
      { error: "Invalid scheduled start date/time for the origin airport time zone." },
      { status: 400 }
    );
  }
  if (parsed.data.plannedEndDate && plannedEndFromParts === null) {
    return NextResponse.json(
      { error: "Invalid scheduled end date/time for the destination airport time zone." },
      { status: 400 }
    );
  }

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

  const flight = await prisma.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        userId: user.id,
        tailNumber: aircraft.tailNumber,
        tailNumberSnapshot: aircraft.tailNumber,
        aircraftId: aircraft.id,
        origin: originLabel,
        originAirportId: originAirport?.id ?? null,
        destination: destinationLabel,
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
        startTime: plannedStart,
        status: "PLANNED",
        statsJson: {
          startTimeZone,
          endTimeZone
        },
        participants: {
          create: [{ userId: user.id, role: selfRole }]
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
      startedAt: null,
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
      plannedEndTime: plannedEnd?.toISOString() ?? null,
      startTimeZone,
      endTimeZone
    }
  });

  return NextResponse.json({ flightId: flight.id }, { status: 201 });
}
