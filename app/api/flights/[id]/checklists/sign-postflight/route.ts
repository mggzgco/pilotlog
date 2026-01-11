import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { verifyPassword } from "@/app/lib/password";
import { recordAuditEvent } from "@/app/lib/audit";
import { triggerAutoImportForFlight } from "@/app/lib/flights/auto-import";

const signSchema = z.object({
  signatureName: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const redirectUrl = new URL(`/flights/${params.id}`, request.url);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = signSchema.safeParse(raw);
  if (!parsed.success) {
    redirectUrl.searchParams.set("toast", "Invalid signature details.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      checklistRuns: {
        include: { items: true }
      }
    }
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

  if (run.status !== "IN_PROGRESS") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist not started.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const remainingRequired = run.items.filter(
    (item) => item.kind !== "SECTION" && item.required && !item.completed
  );

  if (remainingRequired.length > 0) {
    redirectUrl.searchParams.set(
      "toast",
      "Complete required items before signing the post-flight checklist."
    );
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

  await prisma.$transaction(async (tx) => {
    await tx.flightChecklistRun.update({
      where: { id: run.id },
      data: {
        status: "SIGNED",
        decision: "ACCEPTED",
        decisionNote: null,
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
    action: "postflight_signed",
    entityType: "Flight",
    entityId: flight.id
  });

  const autoImportResult = await triggerAutoImportForFlight({
    flightId: flight.id,
    userId: user.id
  });

  if (autoImportResult.status === "AMBIGUOUS") {
    return NextResponse.redirect(new URL(`/flights/${flight.id}/match`, request.url));
  }

  if (autoImportResult.status === "MATCHED") {
    redirectUrl.searchParams.set("adsbImport", "matched");
  }

  if (autoImportResult.status === "FAILED") {
    redirectUrl.searchParams.set("toast", "Post-flight checklist signed, but ADS-B import failed.");
    redirectUrl.searchParams.set("toastType", "error");
  } else {
    redirectUrl.searchParams.set("toast", "Post-flight checklist signed.");
    redirectUrl.searchParams.set("toastType", "success");
  }

  return NextResponse.redirect(redirectUrl);
}
