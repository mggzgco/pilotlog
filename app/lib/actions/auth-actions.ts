"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { lucia } from "@/app/lib/auth/lucia";
import { prisma } from "@/app/lib/db";
import { hashPassword, verifyPassword } from "@/app/lib/password";
import { recordAuditEvent } from "@/app/lib/audit";
import { validateCsrf } from "@/app/lib/auth/csrf";
import { createApprovalToken, hashApprovalToken, approvalTokenExpiry } from "@/app/lib/auth/approvals";
import { sendApprovalEmail } from "@/app/lib/auth/email";
import { getCurrentUser } from "@/app/lib/auth/session";
import {
  consumeLoginAttempt,
  formatRateLimitError,
  resetLoginAttempts
} from "@/app/lib/auth/rate-limit";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "@/app/lib/validation";

export type AuthFormState = { error?: string; success?: string };

function getClientIp() {
  const forwarded = headers().get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  return headers().get("x-real-ip") ?? "unknown";
}

export async function registerAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    return { error: csrf.error };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid registration data." };
  }

  const { email, name, password, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { error: "Account already exists." };
  }

  // AUTH-001: never store plaintext passwords
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      phone,
      passwordHash,
      status: "PENDING"
    }
  });

  // AUTH-006: notify approver about new account registration
  const approverEmail = process.env.APPROVER_EMAIL || "groendykm@icloud.com";
  const token = createApprovalToken();
  const tokenHash = hashApprovalToken(token);
  const expiresAt = approvalTokenExpiry();

  await prisma.accountApprovalToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const approveUrl = new URL(`/api/admin/approve?token=${token}`, baseUrl).toString();
  const rejectUrl = new URL(`/api/admin/reject?token=${token}`, baseUrl).toString();

  try {
    await sendApprovalEmail({
      approverEmail,
      applicantName: user.name,
      applicantEmail: user.email,
      applicantPhone: user.phone,
      approveUrl,
      rejectUrl
    });
  } catch (error) {
    console.error("Failed to send approval email", error);
    return { error: "Unable to send approval email. Please contact support." };
  }

  await recordAuditEvent({
    userId: user.id,
    action: "auth.registered",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      approverEmail
    }
  });

  redirect("/login?registered=1");
}

export async function loginAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    return { error: csrf.error };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid credentials." };
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const limiterKey = `${getClientIp()}:${normalizedEmail}`;
  const limiter = consumeLoginAttempt(limiterKey);
  if (!limiter.allowed) {
    return { error: formatRateLimitError(limiter.resetAt) };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return { error: "Invalid credentials." };
  }

  // AUTH-004: pending accounts cannot sign in until approved
  if (user.status === "PENDING") {
    return { error: "Account pending approval. Please wait for an admin to approve." };
  }

  if (user.status === "DISABLED") {
    return { error: "Account disabled. Contact support for help." };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  // AUTH-003: email/password authentication with session cookies
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  resetLoginAttempts(limiterKey);
  await recordAuditEvent({
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    return { error: csrf.error };
  }

  const { user } = await getCurrentUser();
  const sessionId = cookies().get(lucia.sessionCookieName)?.value;
  if (sessionId) {
    await lucia.invalidateSession(sessionId);
  }
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  // AUTH-007: logout clears session cookie
  await recordAuditEvent({
    userId: user?.id ?? null,
    action: "auth.logout"
  });
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email." };
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "If the email exists, a reset link will be sent." };
  }

  // AUTH-008: issue expiring password reset tokens
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt
    }
  });

  // AUTH-009: send reset link via email (mocked)
  console.log(`Password reset for ${email}: /reset-password?token=${token}`);

  return { success: "Reset link sent." };
}

export async function resetPasswordAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid reset data." };
  }

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  // AUTH-010: single-use reset tokens
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Token invalid or expired." };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    })
  ]);

  return { success: "Password reset. Please log in." };
}

export async function registerFormAction(
  _prevState: AuthFormState,
  formData: FormData
) {
  return registerAction(formData);
}

export async function loginFormAction(
  _prevState: AuthFormState,
  formData: FormData
) {
  return loginAction(formData);
}

export async function forgotPasswordFormAction(
  _prevState: AuthFormState,
  formData: FormData
) {
  return forgotPasswordAction(formData);
}

export async function resetPasswordFormAction(
  _prevState: AuthFormState,
  formData: FormData
) {
  return resetPasswordAction(formData);
}
