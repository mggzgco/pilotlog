import type { AutoImportStatus, Flight, FlightChecklistRun } from "@prisma/client";
import type { FlightCandidate } from "@/app/lib/adsb/types";
import { prisma } from "@/app/lib/db";
import { defaultProviderName, getAdsbProvider } from "@/app/lib/adsb";
import { dedupeImportCandidates } from "@/app/lib/flights/imports";
import { computeDistanceNm, computeDurationMinutes } from "@/app/lib/flights/compute";
import { recordAuditEvent } from "@/app/lib/audit";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const AUTO_MATCH_THRESHOLD_MS = 20 * 60 * 1000;

type FlightWithChecklistRuns = Pick<
  Flight,
  | "plannedStartTime"
  | "plannedEndTime"
  | "startTime"
  | "endTime"
  | "tailNumber"
  | "tailNumberSnapshot"
  | "importedProvider"
  | "providerFlightId"
> & {
  checklistRuns: Array<Pick<FlightChecklistRun, "phase" | "signedAt">>;
};

export function deriveAutoImportWindow(flight: FlightWithChecklistRuns) {
  // Use the known flight times (or planned times as a fallback) and search +/- 2 hours.
  // Timestamps are stored as UTC but entered as local wall-clock times. Convert the stored
  // times to their intended local wall-clock UTC equivalents by subtracting the local
  // timezone offset, then build the +/- 2 hour window around those values.
  const baseStart = flight.startTime ?? flight.plannedStartTime ?? new Date();
  const baseEnd = flight.endTime ?? flight.plannedEndTime ?? baseStart;
  const offsetMs = baseStart.getTimezoneOffset() * 60 * 1000;

  const startUtc = baseStart.getTime() - offsetMs;
  const endUtc = baseEnd.getTime() - offsetMs;

  const searchStart = new Date(startUtc - TWO_HOURS_MS);
  const searchEnd = new Date(endUtc + TWO_HOURS_MS);

  return {
    searchStart,
    searchEnd,
    referenceStart: new Date(startUtc),
    referenceEnd: new Date(endUtc),
    preflightSignedAt: null,
    postflightSignedAt: null
  };
}

export function scoreAutoImportCandidate(
  referenceStart: Date,
  referenceEnd: Date,
  candidateStart: Date,
  candidateEnd: Date
) {
  const startDiff = Math.abs(candidateStart.getTime() - referenceStart.getTime());
  const endDiff = Math.abs(candidateEnd.getTime() - referenceEnd.getTime());
  return startDiff + endDiff;
}

function scoreCandidateForAutoMatch(
  window: ReturnType<typeof deriveAutoImportWindow>,
  candidate: FlightCandidate
) {
  let score = scoreAutoImportCandidate(
    window.referenceStart,
    window.referenceEnd,
    candidate.startTime,
    candidate.endTime
  );

  return score;
}

function selectBestCandidate(
  candidates: FlightCandidate[],
  window: ReturnType<typeof deriveAutoImportWindow>
) {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidateForAutoMatch(window, candidate)
    }))
    .sort((a, b) => a.score - b.score);

  const [first, second] = scored;
  if (!first) {
    return { selected: null, isClearMatch: false };
  }

  if (!second) {
    return { selected: first.candidate, isClearMatch: true };
  }

  const isClearMatch = second.score - first.score >= AUTO_MATCH_THRESHOLD_MS;
  return { selected: first.candidate, isClearMatch };
}

export async function attachAdsbCandidateToFlight({
  flight,
  userId,
  provider,
  candidate
}: {
  flight: Flight;
  userId: string;
  provider: string;
  candidate: FlightCandidate;
}) {
  const trackPoints = candidate.track
    .map((point) => ({
      recordedAt: point.recordedAt,
      latitude: point.latitude,
      longitude: point.longitude,
      altitudeFeet: point.altitudeFeet ?? null,
      groundspeedKt: point.groundspeedKt ?? null,
      headingDeg: point.headingDeg ?? null
    }))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const durationMinutes =
    candidate.durationMinutes ??
    computeDurationMinutes(candidate.startTime, candidate.endTime, trackPoints);
  const distanceNm = candidate.distanceNm ?? computeDistanceNm(trackPoints);
  const roundedDuration = durationMinutes ? Math.round(durationMinutes) : null;
  const roundedDistance = distanceNm ? Math.round(distanceNm) : null;
  const totalTimeHours =
    durationMinutes !== null && durationMinutes !== undefined
      ? Math.round((durationMinutes / 60) * 100) / 100
      : null;

  return prisma.$transaction(async (tx) => {
    await tx.trackPoint.deleteMany({ where: { flightId: flight.id } });

    if (trackPoints.length > 0) {
      await tx.trackPoint.createMany({
        data: trackPoints.map((point) => ({
          flightId: flight.id,
          recordedAt: point.recordedAt,
          latitude: point.latitude,
          longitude: point.longitude,
          altitudeFeet: point.altitudeFeet,
          groundspeedKt: point.groundspeedKt,
          headingDeg: point.headingDeg
        }))
      });
    }

    const updatedFlight = await tx.flight.update({
      where: { id: flight.id },
      data: {
        importedProvider: provider,
        providerFlightId: candidate.providerFlightId,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        durationMinutes: roundedDuration,
        distanceNm: roundedDistance,
        origin: candidate.depLabel,
        destination: candidate.arrLabel,
        statsJson: candidate.stats ?? null,
        status: "IMPORTED",
        autoImportStatus: "MATCHED",
        autoImportLastError: null
      }
    });

    const logbookEntry = await tx.logbookEntry.findFirst({
      where: { flightId: flight.id }
    });

    if (!logbookEntry) {
      await tx.logbookEntry.create({
        data: {
          userId,
          flightId: flight.id,
          date: candidate.startTime,
          totalTime: totalTimeHours
        }
      });
    } else if (logbookEntry.totalTime === null && totalTimeHours !== null) {
      await tx.logbookEntry.update({
        where: { id: logbookEntry.id },
        data: { totalTime: totalTimeHours }
      });
    }

    return updatedFlight;
  });
}

async function updateAutoImportStatus(
  flightId: string,
  status: AutoImportStatus,
  errorMessage?: string | null
) {
  await prisma.flight.update({
    where: { id: flightId },
    data: {
      autoImportStatus: status,
      autoImportLastError: errorMessage ?? null
    }
  });
}

export async function triggerAutoImportForFlight({
  flightId,
  userId
}: {
  flightId: string;
  userId: string;
}) {
  // TODO: For production, move ADS-B provider calls to a background job queue.
  await updateAutoImportStatus(flightId, "RUNNING", null);

  await recordAuditEvent({
    userId,
    action: "adsb_auto_import_started",
    entityType: "Flight",
    entityId: flightId
  });

  try {
    const flight = await prisma.flight.findFirst({
      where: { id: flightId, userId },
      include: {
        checklistRuns: {
          select: { phase: true, signedAt: true }
        }
      }
    });

    if (!flight) {
      await updateAutoImportStatus(flightId, "FAILED", "Flight not found.");
      await recordAuditEvent({
        userId,
        action: "adsb_auto_import_failed",
        entityType: "Flight",
        entityId: flightId,
        metadata: { reason: "Flight not found." }
      });
      return { status: "FAILED" as const };
    }

    if (flight.importedProvider && flight.providerFlightId) {
      await updateAutoImportStatus(flightId, "MATCHED", null);
      return { status: "MATCHED" as const };
    }

    const tailNumber = flight.tailNumberSnapshot?.trim() || flight.tailNumber?.trim();
    if (!tailNumber) {
      await updateAutoImportStatus(flightId, "FAILED", "Flight tail number is missing.");
      await recordAuditEvent({
        userId,
        action: "adsb_auto_import_failed",
        entityType: "Flight",
        entityId: flightId,
        metadata: { reason: "Flight tail number is missing." }
      });
      return { status: "FAILED" as const };
    }

    const window = deriveAutoImportWindow(flight);
    const providerClient = getAdsbProvider();
    const candidates = dedupeImportCandidates(
      await providerClient.searchFlights(tailNumber, window.searchStart, window.searchEnd)
    );

    if (candidates.length === 0) {
      await updateAutoImportStatus(flightId, "NOT_FOUND", null);
      await recordAuditEvent({
        userId,
        action: "adsb_auto_import_not_found",
        entityType: "Flight",
        entityId: flightId
      });
      return { status: "NOT_FOUND" as const };
    }

    if (candidates.length === 1) {
      await attachAdsbCandidateToFlight({
        flight,
        userId,
        provider: defaultProviderName,
        candidate: candidates[0]
      });
      await recordAuditEvent({
        userId,
        action: "adsb_auto_import_matched",
        entityType: "Flight",
        entityId: flightId,
        metadata: { providerFlightId: candidates[0].providerFlightId }
      });
      return { status: "MATCHED" as const };
    }

    const selection = selectBestCandidate(candidates, window);
    if (selection.selected && selection.isClearMatch) {
      await attachAdsbCandidateToFlight({
        flight,
        userId,
        provider: defaultProviderName,
        candidate: selection.selected
      });
      await recordAuditEvent({
        userId,
        action: "adsb_auto_import_matched",
        entityType: "Flight",
        entityId: flightId,
        metadata: { providerFlightId: selection.selected.providerFlightId }
      });
      return { status: "MATCHED" as const };
    }

    await updateAutoImportStatus(flightId, "AMBIGUOUS", null);
    await recordAuditEvent({
      userId,
      action: "adsb_auto_import_ambiguous",
      entityType: "Flight",
      entityId: flightId,
      metadata: { candidateCount: candidates.length }
    });
    return { status: "AMBIGUOUS" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto import failed.";
    await updateAutoImportStatus(flightId, "FAILED", message);
    await recordAuditEvent({
      userId,
      action: "adsb_auto_import_failed",
      entityType: "Flight",
      entityId: flightId,
      metadata: { reason: message }
    });
    return { status: "FAILED" as const };
  }
}
