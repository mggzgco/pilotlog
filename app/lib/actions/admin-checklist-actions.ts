"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { validateCsrf } from "@/app/lib/auth/csrf";
import { recordAuditEvent } from "@/app/lib/audit";

const createSchema = z.object({
  name: z.string().min(1),
  phase: z.enum(["PREFLIGHT", "POSTFLIGHT"]),
  isDefault: z.boolean().optional()
});

const templateIdSchema = z.object({
  templateId: z.string().min(1)
});

export async function adminCreateGlobalChecklistTemplateAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) return { error: csrf.error };
  const admin = await requireAdmin();

  const parsed = createSchema.safeParse({
    name: String(formData.get("name") || "").trim(),
    phase: String(formData.get("phase") || "").trim(),
    isDefault: formData.get("isDefault") === "on"
  });
  if (!parsed.success) return { error: "Invalid template data." };

  const created = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.checklistTemplate.updateMany({
        where: { userId: null, phase: parsed.data.phase, isDefault: true },
        data: { isDefault: false }
      });
    }

    return tx.checklistTemplate.create({
      data: {
        userId: null,
        name: parsed.data.name,
        phase: parsed.data.phase,
        isDefault: Boolean(parsed.data.isDefault)
      },
      select: { id: true, name: true, phase: true }
    });
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.checklist_template.created",
    entityType: "ChecklistTemplate",
    entityId: created.id,
    metadata: { name: created.name, phase: created.phase, scope: "global" }
  });

  redirect(`/admin/checklists/${created.id}`);
}

export async function adminSetGlobalChecklistTemplateDefaultAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) return { error: csrf.error };
  const admin = await requireAdmin();

  const parsed = templateIdSchema.safeParse({
    templateId: String(formData.get("templateId") || "")
  });
  if (!parsed.success) return { error: "Template is required." };

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: parsed.data.templateId, userId: null }
  });
  if (!template) return { error: "Template not found." };

  await prisma.$transaction([
    prisma.checklistTemplate.updateMany({
      where: { userId: null, phase: template.phase, isDefault: true },
      data: { isDefault: false }
    }),
    prisma.checklistTemplate.update({
      where: { id: template.id },
      data: { isDefault: true }
    })
  ]);

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.checklist_template.default_set",
    entityType: "ChecklistTemplate",
    entityId: template.id,
    metadata: { phase: template.phase, scope: "global" }
  });

  redirect("/admin/checklists");
}

export async function adminDeleteGlobalChecklistTemplateAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) return { error: csrf.error };
  const admin = await requireAdmin();

  const parsed = templateIdSchema.safeParse({
    templateId: String(formData.get("templateId") || "")
  });
  if (!parsed.success) return { error: "Template is required." };

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: parsed.data.templateId, userId: null }
  });
  if (!template) return { error: "Template not found." };

  await prisma.checklistTemplate.delete({ where: { id: template.id } });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.checklist_template.deleted",
    entityType: "ChecklistTemplate",
    entityId: template.id,
    metadata: { phase: template.phase, name: template.name, scope: "global" }
  });

  redirect("/admin/checklists");
}

export async function adminImportGroendykmSr20TemplatesAction() {
  const csrf = validateCsrf();
  if (!csrf.ok) return { error: csrf.error };
  const admin = await requireAdmin();

  const owner = await prisma.user.findUnique({
    where: { email: "groendykm@icloud.com" },
    select: { id: true }
  });
  if (!owner) {
    redirect("/admin/checklists?toast=Owner%20account%20not%20found.&toastType=error");
  }

  const sourceTemplates = await prisma.checklistTemplate.findMany({
    where: {
      userId: owner.id,
      OR: [
        { name: { contains: "SR20", mode: "insensitive" } },
        { makeModel: { contains: "SR20", mode: "insensitive" } }
      ]
    },
    include: { items: { orderBy: { personalOrder: "asc" } } },
    orderBy: [{ phase: "asc" }, { createdAt: "asc" }]
  });

  if (sourceTemplates.length === 0) {
    redirect("/admin/checklists?toast=No%20SR20%20templates%20found%20to%20import.&toastType=error");
  }

  const existingGlobal = await prisma.checklistTemplate.findMany({
    where: { userId: null },
    select: { id: true, name: true, phase: true }
  });
  const existingKey = new Set(existingGlobal.map((t) => `${t.phase}:${t.name.toLowerCase()}`));

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const tmpl of sourceTemplates) {
      const key = `${tmpl.phase}:${tmpl.name.toLowerCase()}`;
      if (existingKey.has(key)) continue;

      const created = await tx.checklistTemplate.create({
        data: {
          userId: null,
          name: tmpl.name,
          phase: tmpl.phase,
          isDefault: false,
          makeModel: tmpl.makeModel ?? null
        },
        select: { id: true }
      });

      const idMap = new Map<string, string>();
      // Create sections first
      for (const item of tmpl.items.filter((i) => i.kind === "SECTION")) {
        const createdItem = await tx.checklistTemplateItem.create({
          data: {
            templateId: created.id,
            kind: item.kind,
            parentId: null,
            order: item.order,
            officialOrder: item.officialOrder,
            personalOrder: item.personalOrder,
            title: item.title,
            itemLabel: item.itemLabel,
            acceptanceCriteria: item.acceptanceCriteria,
            details: item.details,
            required: item.required,
            inputType: item.inputType
          },
          select: { id: true }
        });
        idMap.set(item.id, createdItem.id);
      }
      // Then steps + any root steps
      for (const item of tmpl.items.filter((i) => i.kind !== "SECTION")) {
        const createdItem = await tx.checklistTemplateItem.create({
          data: {
            templateId: created.id,
            kind: item.kind,
            parentId: item.parentId ? idMap.get(item.parentId) ?? null : null,
            order: item.order,
            officialOrder: item.officialOrder,
            personalOrder: item.personalOrder,
            title: item.title,
            itemLabel: item.itemLabel,
            acceptanceCriteria: item.acceptanceCriteria,
            details: item.details,
            required: item.required,
            inputType: item.inputType
          },
          select: { id: true }
        });
        idMap.set(item.id, createdItem.id);
      }

      imported += 1;
      existingKey.add(key);
    }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.checklist_template.imported_sr20",
    entityType: "ChecklistTemplate",
    entityId: "bulk",
    metadata: { imported }
  });

  redirect(`/admin/checklists?toast=Imported%20${imported}%20SR20%20template${imported===1?"":"s"}.&toastType=success`);
}
