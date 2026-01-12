import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { replaceChecklistRunItems } from "@/app/lib/checklists/snapshot";

const schema = z.object({
  phase: z.enum(["PREFLIGHT", "POSTFLIGHT"]),
  templateId: z.string().trim().min(1).nullable().optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      aircraftId: true,
      statsJson: true,
      checklistRuns: { select: { id: true, phase: true, status: true, startedAt: true } }
    }
  });
  if (!flight) {
    return NextResponse.json({ error: "Flight not found." }, { status: 404 });
  }

  const templateId = parsed.data.templateId ?? null;

  const template =
    templateId
      ? await prisma.checklistTemplate.findFirst({
          where: { id: templateId, userId: user.id, phase: parsed.data.phase },
          include: { items: { orderBy: { personalOrder: "asc" } } }
        })
      : await selectChecklistTemplate({
          userId: user.id,
          aircraftId: flight.aircraftId,
          phase: parsed.data.phase
        });
  if (!template) {
    return NextResponse.json(
      { error: "Checklist template not found for this user/phase." },
      { status: 404 }
    );
  }

  const stats =
    flight.statsJson && typeof flight.statsJson === "object" && !Array.isArray(flight.statsJson)
      ? (flight.statsJson as Record<string, unknown>)
      : {};
  const overrides =
    stats.checklistTemplateOverrides &&
    typeof stats.checklistTemplateOverrides === "object" &&
    !Array.isArray(stats.checklistTemplateOverrides)
      ? (stats.checklistTemplateOverrides as Record<string, unknown>)
      : {};

  const nextOverrides =
    parsed.data.phase === "PREFLIGHT"
      ? { ...overrides, preflightTemplateId: templateId }
      : { ...overrides, postflightTemplateId: templateId };

  await prisma.flight.update({
    where: { id: flight.id },
    data: {
      statsJson: {
        ...stats,
        checklistTemplateOverrides: nextOverrides
      }
    }
  });

  // If the flight hasn't started and the checklist has no progress, refresh the snapshot immediately
  // so the checklist page shows the selected template right away.
  const run = flight.checklistRuns.find((r) => r.phase === parsed.data.phase) ?? null;
  if (run && flight.status === "PLANNED" && !run.startedAt && run.status !== "SIGNED") {
    const completedCount = await prisma.flightChecklistItem.count({
      where: { checklistRunId: run.id, kind: "STEP", completed: true }
    });
    if (completedCount === 0) {
      await prisma.$transaction(async (tx) => {
        await replaceChecklistRunItems({ client: tx, checklistRunId: run.id, template });
      });
    }
  }

  return NextResponse.json({ ok: true });
}

