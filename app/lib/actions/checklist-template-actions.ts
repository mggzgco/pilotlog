"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const validPhases = new Set(["PREFLIGHT", "POSTFLIGHT"]);

export async function createChecklistTemplateAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (!name || !validPhases.has(phase)) {
    return { error: "Invalid template data." };
  }

  const user = await requireUser();
  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.checklistTemplate.updateMany({
        where: {
          userId: user.id,
          phase: phase as "PREFLIGHT" | "POSTFLIGHT",
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    await tx.checklistTemplate.create({
      data: {
        userId: user.id,
        name,
        phase: phase as "PREFLIGHT" | "POSTFLIGHT",
        isDefault
      }
    });
  });

  redirect("/checklists");
}

export async function addChecklistTemplateItemAction(formData: FormData) {
  const templateId = String(formData.get("templateId") || "").trim();
  const title = String(formData.get("title") || "").trim();

  if (!templateId || !title) {
    return { error: "Checklist item requires a title." };
  }

  const user = await requireUser();
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId: user.id },
    select: { id: true }
  });

  if (!template) {
    return { error: "Checklist template not found." };
  }

  const lastItem = await prisma.checklistTemplateItem.findFirst({
    where: { templateId },
    orderBy: { personalOrder: "desc" },
    select: { personalOrder: true }
  });

  const nextOrder = (lastItem?.personalOrder ?? 0) + 1;
  await prisma.checklistTemplateItem.create({
    data: {
      templateId,
      title,
      kind: "STEP",
      parentId: null,
      officialOrder: nextOrder,
      personalOrder: nextOrder,
      order: nextOrder,
      required: true,
      inputType: "CHECK"
    }
  });

  redirect("/checklists");
}

export async function moveChecklistTemplateItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") || "").trim();
  const direction = String(formData.get("direction") || "").trim();

  if (!itemId || !["up", "down"].includes(direction)) {
    return { error: "Invalid item move." };
  }

  const user = await requireUser();
  const item = await prisma.checklistTemplateItem.findUnique({
    where: { id: itemId },
    include: { template: true }
  });

  if (!item || item.template.userId !== user.id) {
    return { error: "Checklist item not found." };
  }

  const target = await prisma.checklistTemplateItem.findFirst({
    where: {
      templateId: item.templateId,
      personalOrder:
        direction === "up" ? { lt: item.personalOrder } : { gt: item.personalOrder }
    },
    orderBy: { personalOrder: direction === "up" ? "desc" : "asc" }
  });

  if (!target) {
    redirect("/checklists");
  }

  await prisma.$transaction([
    prisma.checklistTemplateItem.update({
      where: { id: item.id },
      data: { personalOrder: target.personalOrder, order: target.personalOrder }
    }),
    prisma.checklistTemplateItem.update({
      where: { id: target.id },
      data: { personalOrder: item.personalOrder, order: item.personalOrder }
    })
  ]);

  redirect("/checklists");
}

export async function setChecklistTemplateDefaultAction(formData: FormData) {
  const templateId = String(formData.get("templateId") || "").trim();

  if (!templateId) {
    return { error: "Template is required." };
  }

  const user = await requireUser();
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId: user.id }
  });

  if (!template) {
    return { error: "Template not found." };
  }

  await prisma.$transaction([
    prisma.checklistTemplate.updateMany({
      where: {
        userId: user.id,
        phase: template.phase,
        isDefault: true
      },
      data: { isDefault: false }
    }),
    prisma.checklistTemplate.update({
      where: { id: template.id },
      data: { isDefault: true }
    })
  ]);

  redirect("/checklists");
}
