"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const validPhases = new Set(["PREFLIGHT", "POSTFLIGHT"]);

function redirectWithToast(
  path: string,
  message: string,
  toastType: "success" | "error" | "info"
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}toast=${encodeURIComponent(message)}&toastType=${toastType}`);
}

export async function createChecklistTemplateAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phase = String(formData.get("phase") || "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (!name || !validPhases.has(phase)) {
    redirectWithToast("/checklists", "Invalid template data.", "error");
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

  redirectWithToast("/checklists", "Checklist template created.", "success");
}

export async function addChecklistTemplateItemAction(formData: FormData) {
  const templateId = String(formData.get("templateId") || "").trim();
  const title = String(formData.get("title") || "").trim();

  if (!templateId || !title) {
    redirectWithToast("/checklists", "Checklist item requires a title.", "error");
  }

  const user = await requireUser();
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId: user.id },
    select: { id: true }
  });

  if (!template) {
    redirectWithToast("/checklists", "Checklist template not found.", "error");
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

  redirectWithToast("/checklists", "Checklist item added.", "success");
}

export async function moveChecklistTemplateItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") || "").trim();
  const direction = String(formData.get("direction") || "").trim();

  if (!itemId || !["up", "down"].includes(direction)) {
    redirectWithToast("/checklists", "Invalid item move.", "error");
    return;
  }

  const user = await requireUser();
  const item = await prisma.checklistTemplateItem.findUnique({
    where: { id: itemId },
    include: { template: true }
  });

  if (!item || item.template.userId !== user.id) {
    redirectWithToast("/checklists", "Checklist item not found.", "error");
    return;
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
    redirectWithToast("/checklists", "Checklist item cannot be moved further.", "info");
    return;
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

  redirectWithToast("/checklists", "Checklist reordered.", "success");
}

export async function setChecklistTemplateDefaultAction(formData: FormData) {
  const templateId = String(formData.get("templateId") || "").trim();

  if (!templateId) {
    redirectWithToast("/checklists", "Template is required.", "error");
    return;
  }

  const user = await requireUser();
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId: user.id }
  });

  if (!template) {
    redirectWithToast("/checklists", "Template not found.", "error");
    return;
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

  redirectWithToast("/checklists", "Default checklist updated.", "success");
}
