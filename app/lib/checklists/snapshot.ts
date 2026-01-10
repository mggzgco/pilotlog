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

  const run = await client.flightChecklistRun.create({
    data: {
      flightId,
      phase,
      status,
      startedAt: startedAt ?? null
    }
  });

  // Create items in `personalOrder` order so parent sections are created before children.
  const sorted = [...items].sort((a, b) => {
    const pa = (a.personalOrder ?? a.order ?? 0) as number;
    const pb = (b.personalOrder ?? b.order ?? 0) as number;
    return pa - pb;
  });

  const templateIdToRunId = new Map<string, string>();

  for (const item of sorted) {
    const templateParentId = (item as any).parentId as string | null | undefined;
    const parentId = templateParentId ? templateIdToRunId.get(templateParentId) ?? null : null;

    const officialOrder = (item as any).officialOrder ?? item.order;
    const personalOrder = (item as any).personalOrder ?? item.order;

    const created = await client.flightChecklistItem.create({
      data: {
        checklistRunId: run.id,
        // keep legacy `order` aligned with personal order for stable DB ordering
        order: personalOrder,
        kind: (item as any).kind ?? "STEP",
        parentId,
        officialOrder,
        personalOrder,
        title: item.title,
        details: item.details,
        required: item.required,
        inputType: item.inputType
      },
      select: { id: true }
    });

    templateIdToRunId.set(item.id, created.id);
  }

  return run;
}
