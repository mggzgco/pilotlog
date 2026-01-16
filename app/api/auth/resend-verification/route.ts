import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { buildRedirectUrl } from "@/app/lib/http";
import { createEmailVerificationToken, sendVerification } from "@/app/lib/auth/email-verification";
import { consumeResendVerificationAttempt } from "@/src/lib/security/ratelimit";
import { recordAuditEvent } from "@/app/lib/audit";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const form = await request.formData().catch(() => null);
  const email = (form?.get("email")?.toString() ?? "").trim().toLowerCase();

  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const url = buildRedirectUrl(request, "/account-pending");
    url.searchParams.set("toast", message);
    url.searchParams.set("toastType", toastType);
    return NextResponse.redirect(url, { status: 303 });
  };

  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return redirectWithToast(csrf.error ?? "CSRF validation failed.", "error");
  }

  if (!email) {
    return redirectWithToast("If the email exists, a verification link will be sent.", "success");
  }

  const limiter = consumeResendVerificationAttempt({ ipAddress, email });
  if (!limiter.allowed) {
    return redirectWithToast("If the email exists, a verification link will be sent.", "success");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true }
  });

  await recordAuditEvent({
    userId: user?.id ?? null,
    action: "AUTH_EMAIL_VERIFICATION_SENT",
    entityType: user?.id ? "User" : null,
    entityId: user?.id ?? null,
    ipAddress,
    userAgent,
    metadata: { email, resend: true }
  });

  if (!user || user.status !== "PENDING" || user.emailVerifiedAt) {
    return redirectWithToast("If the email exists, a verification link will be sent.", "success");
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = new URL(`/verify-email?token=${token}`, baseUrl).toString();

  await sendVerification({
    userId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    verifyUrl,
    ipAddress,
    userAgent
  });

  return redirectWithToast("If the email exists, a verification link will be sent.", "success");
}

