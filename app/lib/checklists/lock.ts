import { ChecklistRunStatus, FlightChecklistRun } from "@prisma/client";

export function isChecklistLocked(run: Pick<FlightChecklistRun, "status">) {
  return run.status === ChecklistRunStatus.SIGNED;
}

export function isChecklistAvailable(run: Pick<FlightChecklistRun, "status">) {
  return run.status !== ChecklistRunStatus.NOT_AVAILABLE;
}
