import { ChecklistPhase, ChecklistRunStatus, Prisma } from "@prisma/client";
import type { ChecklistTemplateWithItems } from "@/app/lib/checklists/templates";

const emptyItems: ChecklistTemplateWithItems["items"] = [];

type SnapshotInput = {
  flightId: string;
  phase: ChecklistPhase;
  status: ChecklistRunStatus;
  startedAt?: Date | null;
  template: ChecklistTemplateWithItems | null;
  client: Prisma.TransactionClient;
};

export async function createChecklistRunSnapshot({
  flightId,
  phase,
  status,
  startedAt,
  template,
  client
}: SnapshotInput) {
  const items = template?.items ?? emptyItems;

  return client.flightChecklistRun.create({
    data: {
      flightId,
      phase,
      status,
      startedAt: startedAt ?? null,
      items: {
        create: items.map((item) => ({
          order: item.order,
          title: item.title,
          details: item.details,
          required: item.required,
          inputType: item.inputType
        }))
      }
    }
  });
}
