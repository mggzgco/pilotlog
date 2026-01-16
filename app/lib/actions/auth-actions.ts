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
  consumeRegistrationAttempt,
  formatRateLimitError,
  formatRegistrationRateLimitError,
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
import { createEmailVerificationToken, sendVerification } from "@/app/lib/auth/email-verification";

export type AuthFormState = { error?: string; success?: string };

function getClientIp() {
  const forwarded = headers().get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headers().get("x-real-ip") ?? "unknown";
}

function getUserAgent() {
  return headers().get("user-agent") ?? "unknown";
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
  const ipAddress = getClientIp();
  const userAgent = getUserAgent();

  const limiter = consumeRegistrationAttempt({ ipAddress, email: normalizedEmail });
  if (!limiter.allowed) {
    return { error: formatRegistrationRateLimitError(limiter.resetAt) };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    await recordAuditEvent({
      userId: existing.id,
      action: "AUTH_REGISTER_REQUESTED",
      entityType: "User",
      entityId: existing.id,
      ipAddress,
      userAgent,
      metadata: { email: normalizedEmail, alreadyExists: true }
    });
    redirect("/account-pending");
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

  await recordAuditEvent({
    userId: user.id,
    action: "AUTH_REGISTER_REQUESTED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
    metadata: { email: user.email }
  });

  const { token: verifyToken, tokenHash, expiresAt } = createEmailVerificationToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  // AUTH-006: notify approver about new account registration
  const approverEmail = process.env.APPROVER_EMAIL ?? "";
  const token = createApprovalToken();
  const approvalTokenHash = hashApprovalToken(token);
  const approvalExpiresAt = approvalTokenExpiry();

  await prisma.accountApprovalToken.create({
    data: {
      userId: user.id,
      tokenHash: approvalTokenHash,
      expiresAt: approvalExpiresAt
    }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const verifyUrl = new URL(`/verify-email?token=${verifyToken}`, baseUrl).toString();
  const approveUrl = new URL(`/api/admin/approve?token=${token}`, baseUrl).toString();
  const rejectUrl = new URL(`/api/admin/reject?token=${token}`, baseUrl).toString();

  await sendVerification({
    userId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    verifyUrl,
    ipAddress,
    userAgent
  });

  if (approverEmail) {
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
  } else {
    console.warn("APPROVER_EMAIL is not configured; approval email not sent.");
  }

  await recordAuditEvent({
    userId: user.id,
    action: "AUTH_APPROVAL_REQUESTED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      email: user.email,
      approverEmail: approverEmail || null
    }
  });

  redirect("/account-pending");
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
  const ipAddress = getClientIp();
  const userAgent = getUserAgent();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    await recordAuditEvent({
      action: "AUTH_LOGIN_FAILED",
      ipAddress,
      userAgent,
      metadata: {
        email: normalizedEmail,
        reason: "not_found"
      }
    });
    return { error: "Invalid credentials." };
  }

  // AUTH-004: pending accounts cannot sign in until approved
  if (user.status === "PENDING") {
    await recordAuditEvent({
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        reason: "pending"
      }
    });
    return { error: "Account pending approval. Please verify your email first." };
  }

  if (user.status === "DISABLED") {
    await recordAuditEvent({
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        reason: "disabled"
      }
    });
    return { error: "Account disabled. Contact support for help." };
  }

  if (user.deletedAt) {
    await recordAuditEvent({
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        reason: "deleted"
      }
    });
    return { error: "Account disabled. Contact support for help." };
  }

  if (!user.emailVerifiedAt) {
    await recordAuditEvent({
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        reason: "email_unverified"
      }
    });
    return { error: "Email not verified. Check your email for the verification link." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Account temporarily locked. Try again later." };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const nextFailed = (user.failedLoginCount ?? 0) + 1;
    const shouldLock = nextFailed >= 5;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailed,
        lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : user.lockedUntil
      }
    });
    await recordAuditEvent({
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        reason: "invalid_password"
      }
    });
    return { error: "Invalid credentials." };
  }

  // AUTH-003: email/password authentication with session cookies
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  resetLoginAttempts(limiterKey);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date()
    }
  });
  await recordAuditEvent({
    userId: user.id,
    action: "AUTH_LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      email: user.email
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
    action: "AUTH_LOGOUT",
    ipAddress: getClientIp(),
    userAgent: getUserAgent()
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
  const result = await requestPasswordReset({
    email,
    ipAddress: getClientIp(),
    userAgent: getUserAgent()
  });
  if ("error" in result) {
    return {
      error: typeof result.error === "string" ? result.error : "Unable to process password reset."
    };
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
  const result = await performPasswordReset({
    token,
    password,
    ipAddress: getClientIp(),
    userAgent: getUserAgent()
  });
  if ("error" in result) {
    return {
      error: typeof result.error === "string" ? result.error : "Unable to reset password."
    };
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
