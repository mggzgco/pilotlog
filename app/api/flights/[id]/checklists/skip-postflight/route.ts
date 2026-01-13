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
  redirectUrl.searchParams.set("tab", "postflight");

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
      endTime: true,
      aircraftId: true,
      tailNumber: true,
      tailNumberSnapshot: true,
      aircraft: {
        select: {
          postflightChecklistTemplateId: true,
          aircraftType: { select: { defaultPostflightTemplateId: true } }
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

  const assignedPostflightTemplateId =
    flight.aircraft?.postflightChecklistTemplateId ??
    flight.aircraft?.aircraftType?.defaultPostflightTemplateId ??
    null;

  // For post-flight, honor the same availability rule as starting: allow skipping once preflight signed,
  // flight is completed, or there's an endTime.
  const preflightRun = flight.checklistRuns.find((r) => r.phase === "PREFLIGHT") ?? null;
  const canSkip =
    preflightRun?.status === "SIGNED" ||
    flight.status === "COMPLETED" ||
    Boolean(flight.endTime);
  if (!canSkip) {
    redirectUrl.searchParams.set(
      "toast",
      "Pre-flight checklist must be signed before skipping post-flight."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  let run = flight.checklistRuns.find((r) => r.phase === "POSTFLIGHT") ?? null;
  if (!run && assignedPostflightTemplateId) {
    const template = await selectChecklistTemplate({
      userId: user.id,
      aircraftId,
      phase: "POSTFLIGHT"
    });
    if (template && template.items.length > 0) {
      run = await prisma.$transaction(async (tx) => {
        return await createChecklistRunSnapshot({
          client: tx,
          flightId: flight.id,
          phase: "POSTFLIGHT",
          status: "NOT_AVAILABLE",
          startedAt: null,
          template
        });
      });
    }
  }
  if (!run) {
    redirectUrl.searchParams.set("toast", "Post-flight checklist not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }
  if (run.status === "SIGNED") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist already signed.");
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
      data: { status: "POSTFLIGHT_SIGNED" }
    });
  });

  await recordAuditEvent({
    userId: user.id,
    action: "postflight_skipped",
    entityType: "Flight",
    entityId: flight.id,
    metadata: { decisionNote }
  });

  redirectUrl.searchParams.set("toast", "Post-flight checklist skipped.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}

