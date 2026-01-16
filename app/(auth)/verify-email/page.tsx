import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { validateVerificationToken } from "@/app/lib/auth/email-verification";
import { recordAuditEvent } from "@/app/lib/audit";
import { headers } from "next/headers";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token?.trim() ?? "";

  if (!token) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Invalid verification link</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The verification link is missing or invalid.
        </p>
      </div>
    );
  }

  const validation = await validateVerificationToken(token);
  if (!validation.valid || !validation.record) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Verification link expired</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This verification link is invalid or has expired. Please request a new one.
        </p>
      </div>
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: validation.record.userId },
      data: { emailVerifiedAt: new Date() }
    }),
    prisma.emailVerificationToken.update({
      where: { id: validation.record.id },
      data: { usedAt: new Date() }
    })
  ]);

  await recordAuditEvent({
    userId: validation.record.userId,
    action: "AUTH_EMAIL_VERIFIED",
    entityType: "User",
    entityId: validation.record.userId,
    ipAddress: headers().get("x-real-ip") ?? headers().get("x-forwarded-for") ?? null,
    userAgent: headers().get("user-agent"),
    metadata: { email: validation.record.user.email }
  });

  if (validation.record.user.status === "PENDING") {
    redirect("/account-pending");
  }

  redirect("/login?verified=1");
}

