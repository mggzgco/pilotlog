"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import {
  checklistItemSchema,
  plannedAdsbSelectionSchema,
  plannedFlightSchema,
  plannedFlightSignoffSchema
} from "@/app/lib/validation";
import { getAdsbProvider } from "@/app/lib/adsb";

const PREFLIGHT_ITEMS = [
  { title: "Aircraft documents onboard", required: true },
  { title: "Fuel quantity verified", required: true },
  { title: "Weather reviewed", required: true },
  { title: "Control surfaces checked", required: true }
];

const POSTFLIGHT_ITEMS = [
  { title: "Hobbs/Tach recorded", required: true },
  { title: "Aircraft secured", required: true },
  { title: "Squawks noted", required: false }
];

export async function createPlannedFlightAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid planned flight details." };
  }

  const user = await requireUser();
  const plannedAt = parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : null;

  // CHK-001: create a planned flight with tail number and optional planned date/time
  await prisma.plannedFlight.create({
    data: {
      userId: user.id,
      tailNumber: parsed.data.tailNumber,
      plannedAt,
      checklistItems: {
        create: [
          ...PREFLIGHT_ITEMS.map((item, index) => ({
            type: "PREFLIGHT" as const,
            title: item.title,
            required: item.required,
            order: index
          })),
          ...POSTFLIGHT_ITEMS.map((item, index) => ({
            type: "POSTFLIGHT" as const,
            title: item.title,
            required: item.required,
            order: index
          }))
        ]
      }
    }
  });

  redirect("/planned-flights");
}

export async function toggleChecklistItemAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = checklistItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid checklist update." };
  }

  const user = await requireUser();
  const item = await prisma.plannedChecklistItem.findUnique({
    where: { id: parsed.data.itemId },
    include: { plannedFlight: true }
  });

  if (!item || item.plannedFlight.userId !== user.id) {
    return { error: "Checklist item not found." };
  }

  const isPreflightLocked =
    item.type === "PREFLIGHT" && item.plannedFlight.preflightSignedAt;
  const isPostflightLocked =
    item.type === "POSTFLIGHT" && item.plannedFlight.postflightSignedAt;

  // CHK-004: lock checklist edits after sign-off
  if (isPreflightLocked || isPostflightLocked) {
    return { error: "Checklist is locked." };
  }

  const shouldComplete = parsed.data.completed === "true";

  // CHK-002: allow user to execute checklist items for each planned flight
  await prisma.plannedChecklistItem.update({
    where: { id: item.id },
    data: {
      completedAt: shouldComplete ? new Date() : null,
      completedBy: shouldComplete ? user.id : null
    }
  });

  redirect(`/planned-flights/${item.plannedFlightId}`);
}

export async function preflightSignoffAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSignoffSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid sign-off request." };
  }

  const user = await requireUser();
  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: parsed.data.plannedFlightId },
    include: { checklistItems: true }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    return { error: "Planned flight not found." };
  }

  if (plannedFlight.preflightSignedAt) {
    return { error: "Pre-flight already signed." };
  }

  const requiredIncomplete = plannedFlight.checklistItems.some(
    (item) =>
      item.type === "PREFLIGHT" && item.required && !item.completedAt
  );

  // CHK-003: require all required pre-flight items before sign-off
  if (requiredIncomplete) {
    return { error: "Complete required pre-flight items." };
  }

  // CHK-004: capture sign-off identity + timestamp and lock pre-flight checklist
  await prisma.plannedFlight.update({
    where: { id: plannedFlight.id },
    data: {
      preflightSignedAt: new Date(),
      preflightSignedBy: user.id
    }
  });

  redirect(`/planned-flights/${plannedFlight.id}`);
}

export async function startPostflightAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSignoffSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid post-flight start request." };
  }

  const user = await requireUser();
  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: parsed.data.plannedFlightId }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    return { error: "Planned flight not found." };
  }

  if (!plannedFlight.preflightSignedAt) {
    return { error: "Pre-flight must be signed first." };
  }

  // CHK-005: enable post-flight checklist when flight is complete or started
  await prisma.plannedFlight.update({
    where: { id: plannedFlight.id },
    data: { postflightStartedAt: plannedFlight.postflightStartedAt ?? new Date() }
  });

  redirect(`/planned-flights/${plannedFlight.id}`);
}

export async function postflightSignoffAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedFlightSignoffSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid sign-off request." };
  }

  const user = await requireUser();
  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: parsed.data.plannedFlightId },
    include: { checklistItems: true }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    return { error: "Planned flight not found." };
  }

  if (!plannedFlight.postflightStartedAt) {
    return { error: "Start post-flight checklist first." };
  }

  const requiredIncomplete = plannedFlight.checklistItems.some(
    (item) =>
      item.type === "POSTFLIGHT" && item.required && !item.completedAt
  );

  // CHK-006: require required post-flight items before sign-off
  if (requiredIncomplete) {
    return { error: "Complete required post-flight items." };
  }

  if (plannedFlight.postflightSignedAt) {
    return { error: "Post-flight already signed." };
  }

  const signedAt = new Date();

  const updated = await prisma.plannedFlight.update({
    where: { id: plannedFlight.id },
    data: {
      postflightSignedAt: signedAt,
      postflightSignedBy: user.id
    }
  });

  if (updated.flightId) {
    redirect(`/planned-flights/${plannedFlight.id}`);
  }

  const provider = getAdsbProvider();
  const windowStart = plannedFlight.preflightSignedAt ?? plannedFlight.plannedAt ?? signedAt;
  const windowEnd = signedAt;

  // CHK-007: search ADS-B data using window derived from checklist sign-offs
  const candidates = await provider.searchFlights(
    plannedFlight.tailNumber,
    windowStart,
    windowEnd
  );

  if (candidates.length === 1) {
    const [candidate] = candidates;
    const flight = await prisma.flight.create({
      data: {
        userId: user.id,
        tailNumber: candidate.tailNumber,
        origin: candidate.origin,
        destination: candidate.destination,
        departAt: candidate.departAt,
        arriveAt: candidate.arriveAt,
        durationMins: candidate.durationMins,
        distanceNm: candidate.distanceNm,
        routePolyline: candidate.routePolyline
      }
    });

    await prisma.plannedFlight.update({
      where: { id: plannedFlight.id },
      data: {
        flightId: flight.id,
        adsbMatchStatus: "MATCHED",
        adsbCandidates: null
      }
    });
  } else if (candidates.length > 1) {
    await prisma.plannedFlight.update({
      where: { id: plannedFlight.id },
      data: {
        adsbMatchStatus: "AMBIGUOUS",
        adsbCandidates: candidates
      }
    });
  } else {
    await prisma.plannedFlight.update({
      where: { id: plannedFlight.id },
      data: {
        adsbMatchStatus: "MISSING",
        adsbCandidates: null
      }
    });
  }

  redirect(`/planned-flights/${plannedFlight.id}`);
}

export async function selectAdsbCandidateAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedAdsbSelectionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid ADS-B selection." };
  }

  const user = await requireUser();
  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: parsed.data.plannedFlightId }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    return { error: "Planned flight not found." };
  }

  const flight = await prisma.flight.create({
    data: {
      userId: user.id,
      tailNumber: parsed.data.tailNumber,
      origin: parsed.data.origin,
      destination: parsed.data.destination ? parsed.data.destination : null,
      departAt: new Date(parsed.data.departAt),
      arriveAt: new Date(parsed.data.arriveAt),
      durationMins: parsed.data.durationMins ? Number(parsed.data.durationMins) : null,
      distanceNm: parsed.data.distanceNm ? Number(parsed.data.distanceNm) : null,
      routePolyline: parsed.data.routePolyline ?? null
    }
  });

  // CHK-008: allow user to select ADS-B candidate and associate with planned flight
  await prisma.plannedFlight.update({
    where: { id: plannedFlight.id },
    data: {
      flightId: flight.id,
      adsbMatchStatus: "MATCHED",
      adsbCandidates: null
    }
  });

  redirect(`/planned-flights/${plannedFlight.id}`);
}

export async function manualAdsbAssociationAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = plannedAdsbSelectionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid manual ADS-B details." };
  }

  const user = await requireUser();
  const plannedFlight = await prisma.plannedFlight.findUnique({
    where: { id: parsed.data.plannedFlightId }
  });

  if (!plannedFlight || plannedFlight.userId !== user.id) {
    return { error: "Planned flight not found." };
  }

  const flight = await prisma.flight.create({
    data: {
      userId: user.id,
      tailNumber: parsed.data.tailNumber,
      origin: parsed.data.origin,
      destination: parsed.data.destination ? parsed.data.destination : null,
      departAt: new Date(parsed.data.departAt),
      arriveAt: new Date(parsed.data.arriveAt),
      durationMins: parsed.data.durationMins ? Number(parsed.data.durationMins) : null,
      distanceNm: parsed.data.distanceNm ? Number(parsed.data.distanceNm) : null,
      routePolyline: parsed.data.routePolyline ?? null
    }
  });

  // CHK-008: guide user to manually import ADS-B data if missing
  await prisma.plannedFlight.update({
    where: { id: plannedFlight.id },
    data: {
      flightId: flight.id,
      adsbMatchStatus: "MATCHED",
      adsbCandidates: null
    }
  });

  redirect(`/planned-flights/${plannedFlight.id}`);
}
