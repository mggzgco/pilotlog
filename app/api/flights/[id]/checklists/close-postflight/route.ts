import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { recordAuditEvent } from "@/app/lib/audit";
import { buildRedirectUrl } from "@/app/lib/http";

const closeSchema = z.object({
  signatureName: z.string().min(1),
  note: z.string().optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = buildRedirectUrl(request, `/flights/${params.id}/checklists`);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = closeSchema.safeParse(raw);
  if (!parsed.success) {
    redirectUrl.searchParams.set("toast", "Invalid close details.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: { checklistRuns: true }
  });

  if (!flight) {
    redirectUrl.searchParams.set("toast", "Flight not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const run = flight.checklistRuns.find((entry) => entry.phase === "POSTFLIGHT");
  if (!run) {
    redirectUrl.searchParams.set("toast", "Post-flight checklist not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (run.status === "SIGNED") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist already closed.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  if (run.status !== "IN_PROGRESS") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist not started.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const signatureIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signatureUserAgent = request.headers.get("user-agent") ?? null;
  const signedAt = new Date();
  const decisionNote = [
    "Closed without completion.",
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

    // Unblock the workflow without requiring checklist completion.
    await tx.flight.update({
      where: { id: flight.id },
      data: { status: "POSTFLIGHT_SIGNED" }
    });
  });

  await recordAuditEvent({
    userId: user.id,
    action: "postflight_closed",
    entityType: "Flight",
    entityId: flight.id,
    metadata: { decisionNote }
  });

  redirectUrl.searchParams.set("toast", "Post-flight checklist closed.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}

