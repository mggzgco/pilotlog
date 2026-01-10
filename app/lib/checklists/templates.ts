import { ChecklistPhase, Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";

export type ChecklistTemplateWithItems = Prisma.ChecklistTemplateGetPayload<{
  include: { items: true };
}>;

type SelectTemplateInput = {
  userId: string;
  aircraftId?: string | null;
  phase: ChecklistPhase;
  client?: Prisma.TransactionClient;
};

export async function selectChecklistTemplate({
  userId,
  aircraftId,
  phase,
  client
}: SelectTemplateInput): Promise<ChecklistTemplateWithItems | null> {
  const db = client ?? prisma;
  const templateWithItems = (id: string) =>
    db.checklistTemplate.findFirst({
      where: { id },
      include: { items: { orderBy: { order: "asc" } } }
    });

  if (aircraftId) {
    const aircraft = await db.aircraft.findFirst({
      where: { id: aircraftId, userId },
      select: {
        preflightChecklistTemplateId: true,
        postflightChecklistTemplateId: true,
        aircraftType: {
          select: {
            defaultPreflightTemplateId: true,
            defaultPostflightTemplateId: true
          }
        }
      }
    });

    if (aircraft) {
      const overrideId =
        phase === "PREFLIGHT"
          ? aircraft.preflightChecklistTemplateId
          : aircraft.postflightChecklistTemplateId;
      if (overrideId) {
        return templateWithItems(overrideId);
      }

      const typeDefaultId =
        phase === "PREFLIGHT"
          ? aircraft.aircraftType?.defaultPreflightTemplateId
          : aircraft.aircraftType?.defaultPostflightTemplateId;
      if (typeDefaultId) {
        return templateWithItems(typeDefaultId);
      }
    }
  }

  const userDefault = await db.checklistTemplate.findFirst({
    where: {
      userId,
      phase,
      isDefault: true
    },
    include: { items: { orderBy: { order: "asc" } } }
  });

  if (userDefault) {
    return userDefault;
  }

  const userTemplate = await db.checklistTemplate.findFirst({
    where: {
      userId,
      phase
    },
    orderBy: { updatedAt: "desc" },
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
