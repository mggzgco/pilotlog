import { ChecklistPhase, Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";

export type ChecklistTemplateWithItems = Prisma.ChecklistTemplateGetPayload<{
  include: { items: true };
}>;

type SelectTemplateInput = {
  userId: string;
  tailNumber: string;
  aircraftId?: string | null;
  phase: ChecklistPhase;
  client?: Prisma.TransactionClient;
};

export async function selectChecklistTemplate({
  userId,
  tailNumber,
  aircraftId,
  phase,
  client
}: SelectTemplateInput): Promise<ChecklistTemplateWithItems | null> {
  const db = client ?? prisma;
  const normalizedTail = tailNumber.trim();

  if (aircraftId) {
    const userAircraftDefault = await db.checklistTemplate.findFirst({
      where: {
        userId,
        phase,
        aircraftId,
        isDefault: true
      },
      include: { items: { orderBy: { order: "asc" } } }
    });

    if (userAircraftDefault) {
      return userAircraftDefault;
    }

    const userAircraftTemplate = await db.checklistTemplate.findFirst({
      where: {
        userId,
        phase,
        aircraftId
      },
      orderBy: { updatedAt: "desc" },
      include: { items: { orderBy: { order: "asc" } } }
    });

    if (userAircraftTemplate) {
      return userAircraftTemplate;
    }
  }

  if (normalizedTail) {
    const userTailDefault = await db.checklistTemplate.findFirst({
      where: {
        userId,
        phase,
        aircraftId: null,
        aircraftTailNumber: normalizedTail,
        isDefault: true
      },
      include: { items: { orderBy: { order: "asc" } } }
    });

    if (userTailDefault) {
      return userTailDefault;
    }

    const userTailTemplate = await db.checklistTemplate.findFirst({
      where: {
        userId,
        phase,
        aircraftId: null,
        aircraftTailNumber: normalizedTail
      },
      orderBy: { updatedAt: "desc" },
      include: { items: { orderBy: { order: "asc" } } }
    });

    if (userTailTemplate) {
      return userTailTemplate;
    }
  }

  const userDefault = await db.checklistTemplate.findFirst({
    where: {
      userId,
      phase,
      aircraftId: null,
      aircraftTailNumber: null,
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
      phase,
      aircraftId: null,
      aircraftTailNumber: null
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
      aircraftId: null,
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
      phase,
      aircraftId: null
    },
    include: { items: { orderBy: { order: "asc" } } }
  });
}
