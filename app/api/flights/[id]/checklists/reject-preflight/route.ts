import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { verifyPassword } from "@/app/lib/password";
import { recordAuditEvent } from "@/app/lib/audit";
import { buildRedirectUrl } from "@/app/lib/http";

const rejectSchema = z.object({
  signatureName: z.string().min(1),
  password: z.string().min(1),
  rejectionNote: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = buildRedirectUrl(request, `/flights/${params.id}`);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = rejectSchema.safeParse(raw);
  if (!parsed.success) {
    redirectUrl.searchParams.set("toast", "Invalid rejection details.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      checklistRuns: true
    }
  });

  if (!flight) {
    redirectUrl.searchParams.set("toast", "Flight not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const run = flight.checklistRuns.find((entry) => entry.phase === "PREFLIGHT");
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

  if (run.status !== "IN_PROGRESS") {
    redirectUrl.searchParams.set("toast", "Pre-flight checklist not started.");
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

  const signatureIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signatureUserAgent = request.headers.get("user-agent") ?? null;
  const signedAt = new Date();
  const decisionNote = String(parsed.data.rejectionNote);

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

    // Unblock flow even when rejected.
    await tx.flight.update({
      where: { id: flight.id },
      data: { status: "PREFLIGHT_SIGNED" }
    });
  });

  await recordAuditEvent({
    userId: user.id,
    action: "preflight_rejected",
    entityType: "Flight",
    entityId: flight.id,
    metadata: { decisionNote }
  });

  redirectUrl.searchParams.set("toast", "Pre-flight checklist rejected.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
