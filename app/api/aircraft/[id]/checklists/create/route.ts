import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";

type Payload = {
  phase: "PREFLIGHT" | "POSTFLIGHT";
  name: string;
  sections: Array<{
    title: string;
    instructions?: string;
    officialOrder?: number;
    personalOrder?: number;
    steps: Array<{
      title: string;
      itemLabel?: string;
      acceptanceCriteria?: string;
      instructions?: string;
      officialOrder?: number;
      personalOrder?: number;
    }>;
  }>;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    return NextResponse.json({ error: "Aircraft not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body || (body.phase !== "PREFLIGHT" && body.phase !== "POSTFLIGHT")) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Checklist name is required." }, { status: 400 });
  }

  const sections = Array.isArray(body.sections) ? body.sections : [];
  const cleanedSections = sections
    .map((section) => {
      const title = typeof section.title === "string" ? section.title.trim() : "";
      const instructions =
        typeof section.instructions === "string" ? section.instructions.trim() : "";
      const officialOrder = Number.isFinite(section.officialOrder)
        ? Number(section.officialOrder)
        : null;
      const personalOrder = Number.isFinite(section.personalOrder)
        ? Number(section.personalOrder)
        : null;

      const steps = Array.isArray(section.steps) ? section.steps : [];
      const cleanedSteps = steps
        .map((step) => ({
          title: typeof step.title === "string" ? step.title.trim() : "",
          itemLabel: typeof step.itemLabel === "string" ? step.itemLabel.trim() : "",
          acceptanceCriteria:
            typeof step.acceptanceCriteria === "string" ? step.acceptanceCriteria.trim() : "",
          instructions: typeof step.instructions === "string" ? step.instructions.trim() : "",
          officialOrder: Number.isFinite(step.officialOrder) ? Number(step.officialOrder) : null,
          personalOrder: Number.isFinite(step.personalOrder) ? Number(step.personalOrder) : null
        }))
        .filter((step) => step.title.length > 0)
        .slice(0, 200);

      return {
        title,
        instructions,
        officialOrder,
        personalOrder,
        steps: cleanedSteps
      };
    })
    .filter((section) => section.title.length > 0)
    .slice(0, 50);

  const totalStepCount = cleanedSections.reduce((acc, section) => acc + section.steps.length, 0);
  if (totalStepCount === 0) {
    return NextResponse.json(
      { error: "At least one step title is required." },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        userId: user.id,
        name,
        phase: body.phase,
        isDefault: false
      },
      select: { id: true }
    });

    // Create sections and their steps. Items use global `officialOrder` / `personalOrder` keys.
    // Keep legacy `order` aligned with `personalOrder` for stable DB ordering.
    const orderedSections = [...cleanedSections].sort((a, b) => {
      const pa = a.personalOrder ?? 0;
      const pb = b.personalOrder ?? 0;
      return pa - pb;
    });

    for (const section of orderedSections) {
      const sectionPersonal = section.personalOrder ?? 0;
      const sectionOfficial = section.officialOrder ?? sectionPersonal;

      const sectionItem = await tx.checklistTemplateItem.create({
        data: {
          templateId: template.id,
          kind: "SECTION",
          parentId: null,
          officialOrder: sectionOfficial,
          personalOrder: sectionPersonal,
          order: sectionPersonal,
          title: section.title,
          details: section.instructions || null,
          required: false,
          inputType: "CHECK"
        },
        select: { id: true }
      });

      const orderedSteps = [...section.steps].sort((a, b) => {
        const pa = a.personalOrder ?? 0;
        const pb = b.personalOrder ?? 0;
        return pa - pb;
      });

      for (const step of orderedSteps) {
        const personalOrder = step.personalOrder ?? 0;
        const officialOrder = step.officialOrder ?? personalOrder;
        await tx.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            kind: "STEP",
            parentId: sectionItem.id,
            officialOrder,
            personalOrder,
            order: personalOrder,
            title: step.title,
            itemLabel: step.itemLabel || null,
            acceptanceCriteria: step.acceptanceCriteria || null,
            details: step.instructions || null,
            required: true,
            inputType: "CHECK"
          }
        });
      }
    }

    await tx.aircraft.update({
      where: { id: aircraft.id },
      data:
        body.phase === "PREFLIGHT"
          ? { preflightChecklistTemplateId: template.id }
          : { postflightChecklistTemplateId: template.id }
    });

    return template;
  });

  return NextResponse.json({ ok: true, templateId: created.id });
}

