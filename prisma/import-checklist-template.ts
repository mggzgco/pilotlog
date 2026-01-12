import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { prisma } from "../app/lib/db";

type TemplateJson = {
  phase: "PREFLIGHT" | "POSTFLIGHT";
  name: string;
  makeModel?: string;
  sections: Array<{
    title: string;
    instructions?: string;
    steps?: Array<{
      itemLabel?: string;
      acceptanceCriteria?: string;
      instructions?: string;
    }>;
  }>;
};

function argValue(flag: string): string | null {
  const idx = process.argv.findIndex((a) => a === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const email = argValue("--email");
  const file = argValue("--file");

  if (!email) {
    throw new Error('Missing required arg: --email "you@example.com"');
  }
  if (!file) {
    throw new Error('Missing required arg: --file "data/checklists/xxx.json"');
  }

  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const raw = await fs.readFile(abs, "utf8");
  const parsed = JSON.parse(raw) as TemplateJson;

  if (!parsed || (parsed.phase !== "PREFLIGHT" && parsed.phase !== "POSTFLIGHT")) {
    throw new Error("Invalid template JSON: missing/invalid phase");
  }
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Invalid template JSON: missing/invalid name");
  }
  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("Invalid template JSON: missing/invalid sections");
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        userId: user.id,
        name: parsed.name.trim(),
        phase: parsed.phase,
        isDefault: false,
        makeModel: parsed.makeModel?.trim() || null
      },
      select: { id: true }
    });

    let personalCounter = 1;
    for (const section of parsed.sections) {
      const title = typeof section.title === "string" ? section.title.trim() : "";
      if (!title) continue;

      const createdSection = await tx.checklistTemplateItem.create({
        data: {
          templateId: template.id,
          kind: "SECTION",
          parentId: null,
          personalOrder: personalCounter,
          officialOrder: personalCounter,
          order: personalCounter,
          title,
          details: typeof section.instructions === "string" ? section.instructions.trim() : null,
          required: false,
          inputType: "CHECK"
        },
        select: { id: true }
      });
      personalCounter += 1;

      const steps = Array.isArray(section.steps) ? section.steps : [];
      for (const step of steps) {
        const itemLabel = typeof step.itemLabel === "string" ? step.itemLabel.trim() : "";
        if (!itemLabel) continue;

        await tx.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            kind: "STEP",
            parentId: createdSection.id,
            personalOrder: personalCounter,
            officialOrder: personalCounter,
            order: personalCounter,
            title: itemLabel,
            itemLabel,
            acceptanceCriteria:
              typeof step.acceptanceCriteria === "string" ? step.acceptanceCriteria.trim() : null,
            details: typeof step.instructions === "string" ? step.instructions.trim() : null,
            required: true,
            inputType: "CHECK"
          }
        });
        personalCounter += 1;
      }
    }

    return template;
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, templateId: created.id }, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

