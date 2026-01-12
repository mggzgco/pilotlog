import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

type Exported = {
  exportedAt: string;
  sourceUserEmail: string;
  includeGlobalTemplates: boolean;
  templates: Array<{
    id: string;
    userId: string | null;
    name: string;
    phase: any;
    isDefault: boolean;
    makeModel: string | null;
    items: Array<{
      id: string;
      templateId: string;
      order: number;
      kind: any;
      parentId: string | null;
      officialOrder: number;
      personalOrder: number;
      title: string;
      itemLabel: string | null;
      acceptanceCriteria: string | null;
      details: string | null;
      required: boolean;
      inputType: any;
    }>;
  }>;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function cuidLike(): string {
  return `c${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function uniqueName(desired: string, existing: Set<string>): string {
  if (!existing.has(desired)) return desired;
  for (let i = 2; i < 1000; i++) {
    const next = `${desired} (${i})`;
    if (!existing.has(next)) return next;
  }
  return `${desired} (${Date.now()})`;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const destUserEmail = requireEnv("DEST_USER_EMAIL").toLowerCase();
  const inputPath = process.env.INPUT_PATH || "prisma/.checklists-export.json";
  const dryRun = (process.env.DRY_RUN ?? "").toLowerCase() === "true";
  const preserveIsDefault = (process.env.PRESERVE_IS_DEFAULT ?? "").toLowerCase() === "true";

  const abs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  const exported = JSON.parse(readFileSync(abs, "utf8")) as Exported;

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    const destUser = await prisma.user.findUnique({
      where: { email: destUserEmail },
      select: { id: true, email: true }
    });
    if (!destUser) throw new Error(`Destination user not found: ${destUserEmail}`);

    const existing = await prisma.checklistTemplate.findMany({
      where: { userId: destUser.id },
      select: { name: true, phase: true }
    });

    const existingNamesByPhase = new Map<string, Set<string>>();
    for (const t of existing) {
      const key = String(t.phase);
      const set = existingNamesByPhase.get(key) ?? new Set<string>();
      set.add(t.name);
      existingNamesByPhase.set(key, set);
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          preserveIsDefault,
          importedFrom: exported.sourceUserEmail,
          importedAt: new Date().toISOString(),
          templatesInFile: exported.templates.length,
          inputPath: abs,
          destUser: destUser.email
        },
        null,
        2
      )
    );

    let createdTemplates = 0;
    let createdItems = 0;

    for (const tpl of exported.templates) {
      const phaseKey = String(tpl.phase);
      const existingNames = existingNamesByPhase.get(phaseKey) ?? new Set<string>();
      const desiredName = tpl.userId ? tpl.name : `${tpl.name} (global)`;
      const name = uniqueName(desiredName, existingNames);
      existingNames.add(name);
      existingNamesByPhase.set(phaseKey, existingNames);

      const newTemplateId = cuidLike();

      const itemIdMap = new Map<string, string>();
      for (const item of tpl.items) itemIdMap.set(item.id, cuidLike());

      const newItems: Prisma.ChecklistTemplateItemCreateManyInput[] = tpl.items.map((item) => ({
        id: itemIdMap.get(item.id)!,
        templateId: newTemplateId,
        order: item.order,
        kind: item.kind,
        parentId: item.parentId ? itemIdMap.get(item.parentId) ?? null : null,
        officialOrder: item.officialOrder,
        personalOrder: item.personalOrder,
        title: item.title,
        itemLabel: item.itemLabel,
        acceptanceCriteria: item.acceptanceCriteria,
        details: item.details,
        required: item.required,
        inputType: item.inputType
      }));

      if (dryRun) {
        createdTemplates++;
        createdItems += newItems.length;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.checklistTemplate.create({
          data: {
            id: newTemplateId,
            userId: destUser.id,
            name,
            phase: tpl.phase,
            isDefault: preserveIsDefault ? tpl.isDefault : false,
            makeModel: tpl.makeModel
          }
        });
        if (newItems.length > 0) {
          await tx.checklistTemplateItem.createMany({ data: newItems });
        }
      });

      createdTemplates++;
      createdItems += newItems.length;
    }

    console.log(JSON.stringify({ createdTemplates, createdItems }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

