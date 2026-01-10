import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";

type Payload = {
  phase: "PREFLIGHT" | "POSTFLIGHT";
  name: string;
  steps: Array<{ title: string; instructions?: string }>;
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

  const steps = Array.isArray(body.steps) ? body.steps : [];
  const cleanedSteps = steps
    .map((step) => ({
      title: typeof step.title === "string" ? step.title.trim() : "",
      instructions: typeof step.instructions === "string" ? step.instructions.trim() : ""
    }))
    .filter((step) => step.title.length > 0)
    .slice(0, 200);

  if (cleanedSteps.length === 0) {
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

    await tx.checklistTemplateItem.createMany({
      data: cleanedSteps.map((step, index) => ({
        templateId: template.id,
        order: index + 1,
        title: step.title,
        details: step.instructions || null,
        required: true,
        inputType: "CHECK"
      }))
    });

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

