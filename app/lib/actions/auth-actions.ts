"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
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
} from "@/src/lib/security/ratelimit";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "@/app/lib/validation";
import {
  requestPasswordReset,
  resetPassword as performPasswordReset
} from "@/app/lib/auth/password-reset";

export type AuthFormState = { error?: string; success?: string };

function getClientIp() {
  const forwarded = headers().get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  return headers().get("x-real-ip") ?? "unknown";
}

export async function registerAction(formData: FormData): Promise<AuthFormState> {
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
    // If SMTP isn't configured, the admin can still approve via /admin/approvals.
    console.error("Failed to send approval email", error);
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

export async function loginAction(formData: FormData): Promise<AuthFormState> {
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
    await recordAuditEvent({
      action: "auth.login.failed",
      metadata: {
        email: normalizedEmail,
        reason: "not_found",
        ipAddress: getClientIp()
      }
    });
    return { error: "Invalid credentials." };
  }

  // AUTH-004: pending accounts cannot sign in until approved
  if (user.status === "PENDING") {
    await recordAuditEvent({
      userId: user.id,
      action: "auth.login.failed",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        reason: "pending",
        ipAddress: getClientIp()
      }
    });
    return { error: "Account pending approval. Please wait for an admin to approve." };
  }

  if (user.status === "DISABLED") {
    await recordAuditEvent({
      userId: user.id,
      action: "auth.login.failed",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        reason: "disabled",
        ipAddress: getClientIp()
      }
    });
    return { error: "Account disabled. Contact support for help." };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await recordAuditEvent({
      userId: user.id,
      action: "auth.login.failed",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        reason: "invalid_password",
        ipAddress: getClientIp()
      }
    });
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
    entityId: user.id,
    metadata: {
      ipAddress: getClientIp()
    }
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

export async function forgotPasswordAction(formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email." };
  }

  const { email } = parsed.data;
  const result = await requestPasswordReset({ email, ipAddress: getClientIp() });
  if ("error" in result) {
    return { error: result.error };
  }
  return { success: result.success };
}

export async function resetPasswordAction(formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid reset data." };
  }

  const { token, password } = parsed.data;
  const result = await performPasswordReset({ token, password });
  if ("error" in result) {
    return { error: result.error };
  }
  return { error: undefined, success: result.success };
}

export async function registerFormAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return registerAction(formData);
}

export async function loginFormAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return loginAction(formData);
}

export async function forgotPasswordFormAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return forgotPasswordAction(formData);
}

export async function resetPasswordFormAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return resetPasswordAction(formData);
}
