import { PrismaClient, Prisma } from "@prisma/client";

type Env = {
  SOURCE_DATABASE_URL: string;
  DEST_DATABASE_URL: string;
  SOURCE_USER_EMAIL: string;
  DEST_USER_EMAIL: string;
  DRY_RUN: boolean;
  INCLUDE_GLOBAL_TEMPLATES: boolean;
  PRESERVE_IS_DEFAULT: boolean;
};

function requireEnv(name: keyof Omit<Env, "DRY_RUN" | "INCLUDE_GLOBAL_TEMPLATES" | "PRESERVE_IS_DEFAULT">): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function readEnv(): Env {
  return {
    SOURCE_DATABASE_URL: requireEnv("SOURCE_DATABASE_URL"),
    DEST_DATABASE_URL: requireEnv("DEST_DATABASE_URL"),
    SOURCE_USER_EMAIL: requireEnv("SOURCE_USER_EMAIL").toLowerCase(),
    DEST_USER_EMAIL: requireEnv("DEST_USER_EMAIL").toLowerCase(),
    DRY_RUN: (process.env.DRY_RUN ?? "").toLowerCase() === "true",
    INCLUDE_GLOBAL_TEMPLATES: (process.env.INCLUDE_GLOBAL_TEMPLATES ?? "").toLowerCase() === "true",
    PRESERVE_IS_DEFAULT: (process.env.PRESERVE_IS_DEFAULT ?? "").toLowerCase() === "true"
  };
}

function cuidLike(): string {
  // good enough uniqueness for migration without adding deps
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
  const env = readEnv();

  const source = new PrismaClient({ datasourceUrl: env.SOURCE_DATABASE_URL });
  const dest = new PrismaClient({ datasourceUrl: env.DEST_DATABASE_URL });

  try {
    const [sourceUser, destUser] = await Promise.all([
      source.user.findUnique({
        where: { email: env.SOURCE_USER_EMAIL },
        select: { id: true, email: true }
      }),
      dest.user.findUnique({
        where: { email: env.DEST_USER_EMAIL },
        select: { id: true, email: true }
      })
    ]);

    if (!sourceUser) throw new Error(`Source user not found: ${env.SOURCE_USER_EMAIL}`);
    if (!destUser) throw new Error(`Destination user not found: ${env.DEST_USER_EMAIL}`);

    const whereTemplates: Prisma.ChecklistTemplateWhereInput = env.INCLUDE_GLOBAL_TEMPLATES
      ? { OR: [{ userId: sourceUser.id }, { userId: null }] }
      : { userId: sourceUser.id };

    const templates = await source.checklistTemplate.findMany({
      where: whereTemplates,
      orderBy: [{ phase: "asc" }, { updatedAt: "desc" }],
      include: { items: { orderBy: [{ personalOrder: "asc" }, { order: "asc" }] } }
    });

    const destExisting = await dest.checklistTemplate.findMany({
      where: { userId: destUser.id },
      select: { id: true, name: true, phase: true }
    });

    const existingNamesByPhase = new Map<string, Set<string>>();
    for (const t of destExisting) {
      const key = String(t.phase);
      const set = existingNamesByPhase.get(key) ?? new Set<string>();
      set.add(t.name);
      existingNamesByPhase.set(key, set);
    }

    console.log(
      JSON.stringify(
        {
          dryRun: env.DRY_RUN,
          sourceUser: sourceUser.email,
          destUser: destUser.email,
          templatesFound: templates.length,
          includeGlobalTemplates: env.INCLUDE_GLOBAL_TEMPLATES,
          preserveIsDefault: env.PRESERVE_IS_DEFAULT
        },
        null,
        2
      )
    );

    let createdTemplates = 0;
    let createdItems = 0;

    for (const tpl of templates) {
      const phaseKey = String(tpl.phase);
      const existingNames = existingNamesByPhase.get(phaseKey) ?? new Set<string>();
      const desiredName = tpl.userId ? tpl.name : `${tpl.name} (global)`;
      const name = uniqueName(desiredName, existingNames);
      existingNames.add(name);
      existingNamesByPhase.set(phaseKey, existingNames);

      const newTemplateId = cuidLike();

      const itemIdMap = new Map<string, string>();
      for (const item of tpl.items) {
        itemIdMap.set(item.id, cuidLike());
      }

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

      if (env.DRY_RUN) {
        createdTemplates++;
        createdItems += newItems.length;
        continue;
      }

      await dest.$transaction(async (tx) => {
        await tx.checklistTemplate.create({
          data: {
            id: newTemplateId,
            userId: destUser.id,
            name,
            phase: tpl.phase,
            isDefault: env.PRESERVE_IS_DEFAULT ? tpl.isDefault : false,
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

    console.log(
      JSON.stringify(
        {
          createdTemplates,
          createdItems
        },
        null,
        2
      )
    );
  } finally {
    await Promise.allSettled([source.$disconnect(), dest.$disconnect()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

