import { ChecklistPhase, Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";

export type ChecklistTemplateWithItems = Prisma.ChecklistTemplateGetPayload<{
  include: { items: true };
}>;

type SelectTemplateInput = {
  userId: string;
  tailNumber: string;
  phase: ChecklistPhase;
  client?: Prisma.TransactionClient;
};

export async function selectChecklistTemplate({
  userId,
  tailNumber,
  phase,
  client
}: SelectTemplateInput): Promise<ChecklistTemplateWithItems | null> {
  const db = client ?? prisma;
  const normalizedTail = tailNumber.trim();

  const userTemplate = await db.checklistTemplate.findFirst({
    where: {
      userId,
      phase,
      aircraftTailNumber: normalizedTail
    },
    include: { items: { orderBy: { order: "asc" } } }
  });

  if (userTemplate) {
    return userTemplate;
  }

  const defaultTemplate = await db.checklistTemplate.findFirst({
    where: {
      userId: null,
      phase,
      isDefault: true
    },
    include: { items: { orderBy: { order: "asc" } } }
  });

  if (defaultTemplate) {
    return defaultTemplate;
  }

  return db.checklistTemplate.findFirst({
    where: {
      userId: null,
      phase
    },
    include: { items: { orderBy: { order: "asc" } } }
  });
}
