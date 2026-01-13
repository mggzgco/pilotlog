import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { verifyPassword } from "@/app/lib/password";
import { recordAuditEvent } from "@/app/lib/audit";
import { buildRedirectUrl } from "@/app/lib/http";
import { selectChecklistTemplate } from "@/app/lib/checklists/templates";
import { createChecklistRunSnapshot } from "@/app/lib/checklists/snapshot";

const schema = z.object({
  signatureName: z.string().min(1),
  password: z.string().min(1),
  note: z.string().optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const redirectUrl = buildRedirectUrl(request, `/flights/${params.id}/checklists`);
  redirectUrl.searchParams.set("tab", "preflight");

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    redirectUrl.searchParams.set("toast", "Invalid skip details.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      aircraftId: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      aircraft: {
        select: {
          preflightChecklistTemplateId: true,
          aircraftType: { select: { defaultPreflightTemplateId: true } }
        }
      },
      checklistRuns: true
    }
  });
  if (!flight) {
    redirectUrl.searchParams.set("toast", "Flight not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  // Auto-link aircraft by tail number if missing so template selection works consistently.
  let aircraftId = flight.aircraftId;
  if (!aircraftId) {
    const tail = (flight.tailNumberSnapshot ?? flight.tailNumber ?? "").trim();
    if (tail) {
      const match = await prisma.aircraft.findFirst({
        where: { userId: user.id, tailNumber: { equals: tail, mode: "insensitive" } },
        select: { id: true }
      });
      if (match) {
        await prisma.flight.update({ where: { id: flight.id }, data: { aircraftId: match.id } });
        aircraftId = match.id;
      }
    }
  }

  const assignedPreflightTemplateId =
    flight.aircraft?.preflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPreflightTemplateId ??
    null;

  let run = flight.checklistRuns.find((r) => r.phase === "PREFLIGHT") ?? null;
  if (!run && assignedPreflightTemplateId) {
    const template = await selectChecklistTemplate({
      userId: user.id,
      aircraftId,
      phase: "PREFLIGHT"
    });
    if (template && template.items.length > 0) {
      run = await prisma.$transaction(async (tx) => {
        return await createChecklistRunSnapshot({
          client: tx,
          flightId: flight.id,
          phase: "PREFLIGHT",
          status: "IN_PROGRESS",
          startedAt: null,
          template
        });
      });
    }
  }
  if (!run) {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if (run.status === "SIGNED") {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist already signed.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });
  if (!dbUser || !(await verifyPassword(dbUser.passwordHash, parsed.data.password))) {
    redirectUrl.searchParams.set("toast", "Password confirmation failed.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const signedAt = new Date();
  const signatureIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signatureUserAgent = request.headers.get("user-agent") ?? null;
  const decisionNote = [
    "Skipped.",
    parsed.data.note?.trim() ? `Note: ${parsed.data.note.trim()}` : null
  ]
    .filter(Boolean)
    .join(" ");

  await prisma.$transaction(async (tx) => {
    await tx.flightChecklistRun.update({
      where: { id: run.id },
      data: {
        status: "SIGNED",
        decision: "REJECTED",
        decisionNote,
        signedAt,
        signedByUserId: user.id,
        signatureName: parsed.data.signatureName,
        signatureIp,
        signatureUserAgent
      }
    });
    await tx.flight.update({
      where: { id: flight.id },
      data: { status: "PREFLIGHT_SIGNED" }
    });
  });

  await recordAuditEvent({
    userId: user.id,
    action: "preflight_skipped",
    entityType: "Flight",
    entityId: flight.id,
    metadata: { decisionNote }
  });

  redirectUrl.searchParams.set("toast", "Pre-flight checklist skipped.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}

