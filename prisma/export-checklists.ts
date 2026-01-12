import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const userEmail = requireEnv("USER_EMAIL").toLowerCase();
  const outPath = process.env.OUT_PATH || "prisma/.checklists-export.json";
  const includeGlobalTemplates = (process.env.INCLUDE_GLOBAL_TEMPLATES ?? "").toLowerCase() === "true";

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  prisma
    .$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: userEmail },
        select: { id: true, email: true }
      });
      if (!user) throw new Error(`User not found in source DB: ${userEmail}`);

      const templates = await tx.checklistTemplate.findMany({
        where: includeGlobalTemplates
          ? { OR: [{ userId: user.id }, { userId: null }] }
          : { userId: user.id },
        orderBy: [{ phase: "asc" }, { updatedAt: "desc" }],
        include: { items: { orderBy: [{ personalOrder: "asc" }, { order: "asc" }] } }
      });

      const payload = {
        exportedAt: new Date().toISOString(),
        sourceUserEmail: user.email,
        includeGlobalTemplates,
        templates: templates.map((t) => ({
          id: t.id,
          userId: t.userId,
          name: t.name,
          phase: t.phase,
          isDefault: t.isDefault,
          makeModel: t.makeModel,
          items: t.items.map((i) => ({
            id: i.id,
            templateId: i.templateId,
            order: i.order,
            kind: i.kind,
            parentId: i.parentId,
            officialOrder: i.officialOrder,
            personalOrder: i.personalOrder,
            title: i.title,
            itemLabel: i.itemLabel,
            acceptanceCriteria: i.acceptanceCriteria,
            details: i.details,
            required: i.required,
            inputType: i.inputType
          }))
        }))
      };

      const abs = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
      writeFileSync(abs, JSON.stringify(payload, null, 2) + "\n", "utf8");

      console.log(
        JSON.stringify(
          {
            outPath: abs,
            templatesExported: payload.templates.length,
            itemsExported: payload.templates.reduce((sum, t) => sum + t.items.length, 0)
          },
          null,
          2
        )
      );
    })
    .finally(async () => {
      await prisma.$disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main();

