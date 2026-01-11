import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";

type Payload = {
  name: string;
  // ordered by personal order already (we'll still recompute)
  sections: Array<{
    title: string;
    instructions?: string;
    officialOrder?: number;
    steps: Array<{
      itemLabel?: string;
      acceptanceCriteria?: string;
      instructions?: string;
      officialOrder?: number;
    }>;
  }>;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!template) {
    return NextResponse.json({ error: "Checklist template not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body || typeof body.name !== "string" || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const name = body.name.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const cleanedSections = body.sections
    .map((section) => ({
      title: typeof section.title === "string" ? section.title.trim() : "",
      instructions: typeof section.instructions === "string" ? section.instructions.trim() : "",
      officialOrder: Number.isFinite(section.officialOrder) ? Number(section.officialOrder) : null,
      steps: Array.isArray(section.steps)
        ? section.steps
            .map((step) => ({
              itemLabel: typeof step.itemLabel === "string" ? step.itemLabel.trim() : "",
              acceptanceCriteria:
                typeof step.acceptanceCriteria === "string"
                  ? step.acceptanceCriteria.trim()
                  : "",
              instructions: typeof step.instructions === "string" ? step.instructions.trim() : "",
              officialOrder: Number.isFinite(step.officialOrder) ? Number(step.officialOrder) : null
            }))
            .filter((step) => step.itemLabel.length > 0)
            .slice(0, 200)
        : []
    }))
    .filter((section) => section.title.length > 0)
    .slice(0, 50);

  const totalStepCount = cleanedSections.reduce((acc, section) => acc + section.steps.length, 0);
  if (totalStepCount === 0) {
    return NextResponse.json({ error: "At least one step is required." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.checklistTemplate.update({
      where: { id: template.id },
      data: { name }
    });

    // Replace all items; this keeps ordering and hierarchy consistent.
    await tx.checklistTemplateItem.deleteMany({ where: { templateId: template.id } });

    let personalCounter = 1;

    for (const section of cleanedSections) {
      const sectionPersonal = personalCounter++;
      const sectionOfficial = section.officialOrder ?? sectionPersonal;

      const createdSection = await tx.checklistTemplateItem.create({
        data: {
          templateId: template.id,
          kind: "SECTION",
          parentId: null,
          personalOrder: sectionPersonal,
          officialOrder: sectionOfficial,
          order: sectionPersonal,
          title: section.title,
          details: section.instructions || null,
          required: false,
          inputType: "CHECK"
        },
        select: { id: true }
      });

      for (const step of section.steps) {
        const stepPersonal = personalCounter++;
        const stepOfficial = step.officialOrder ?? stepPersonal;

        await tx.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            kind: "STEP",
            parentId: createdSection.id,
            personalOrder: stepPersonal,
            officialOrder: stepOfficial,
            order: stepPersonal,
            title: step.itemLabel || "Step",
            itemLabel: step.itemLabel || null,
            acceptanceCriteria: step.acceptanceCriteria || null,
            details: step.instructions || null,
            required: true,
            inputType: "CHECK"
          }
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

