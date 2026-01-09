import type { Flight, FlightChecklistRun } from "@prisma/client";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

type FlightWithChecklistRuns = Pick<
  Flight,
  "plannedStartTime" | "plannedEndTime" | "startTime" | "endTime"
> & {
  checklistRuns: Array<Pick<FlightChecklistRun, "phase" | "signedAt">>;
};

export function deriveAutoImportWindow(flight: FlightWithChecklistRuns) {
  const preflightSignedAt =
    flight.checklistRuns.find((run) => run.phase === "PREFLIGHT")?.signedAt ?? null;
  const postflightSignedAt =
    flight.checklistRuns.find((run) => run.phase === "POSTFLIGHT")?.signedAt ?? null;

  const plannedStart = flight.plannedStartTime ?? flight.startTime;
  const plannedEnd = flight.plannedEndTime ?? flight.endTime ?? plannedStart;

  const searchStart = preflightSignedAt
    ? new Date(preflightSignedAt.getTime() - TWO_HOURS_MS)
    : new Date(plannedStart.getTime() - FOUR_HOURS_MS);
  const searchEnd = postflightSignedAt
    ? new Date(postflightSignedAt.getTime() + TWO_HOURS_MS)
    : new Date(plannedEnd.getTime() + FOUR_HOURS_MS);

  return {
    searchStart,
    searchEnd,
    referenceStart: preflightSignedAt ?? plannedStart,
    referenceEnd: postflightSignedAt ?? plannedEnd
  };
}

export async function triggerAutoImportForFlight(flightId: string) {
  // TODO: Implement ADS-B auto import in follow-up prompt.
  console.info("Auto import requested for flight", flightId);
}
