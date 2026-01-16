"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { validateCsrf } from "@/app/lib/auth/csrf";
import { hashResetToken } from "@/app/lib/auth/password-reset";
import { hashPassword } from "@/app/lib/password";
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} from "@/app/lib/auth/email";
import { recordAuditEvent } from "@/app/lib/audit";
import { createEmailVerificationToken, sendVerification } from "@/app/lib/auth/email-verification";

function redirectWithToast(
  path: string,
  message: string,
  toastType: "success" | "error" | "info"
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}toast=${encodeURIComponent(message)}&toastType=${toastType}`);
}

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"])
});

const updateStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "DISABLED"]),
  reason: z.string().optional()
});

const userIdSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional()
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).default("PENDING"),
  verified: z.string().optional(),
  reason: z.string().optional()
});

const updateUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]),
  verified: z.string().optional(),
  reason: z.string().optional()
});

function requireReason(reason: string | undefined) {
  if (!reason || reason.trim().length < 3) {
    return "Reason is required (min 3 characters).";
  }
  return null;
}

export async function adminCreateUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = createUserSchema.safeParse({
    email: String(formData.get("email") || "").toLowerCase(),
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    role: String(formData.get("role") || "USER"),
    status: String(formData.get("status") || "PENDING"),
    verified: String(formData.get("verified") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Invalid user details.", "error");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    redirectWithToast("/admin/users", "Email already in use.", "error");
    return;
  }

  const verified = parsed.data.verified === "true";
  if (parsed.data.status === "ACTIVE" && !verified) {
    redirectWithToast("/admin/users", "Active users must be verified.", "error");
    return;
  }

  const passwordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      status: parsed.data.status,
      emailVerifiedAt: verified ? new Date() : null,
      passwordHash
    }
  });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });
  const resetUrl = new URL(`/reset-password?token=${token}`, getBaseUrl()).toString();

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.created",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      role: user.role,
      status: user.status,
      verified,
      reason: parsed.data.reason ?? null
    }
  });

  redirect(
    `/admin/users/${user.id}?manualLinkType=reset&manualLink=${encodeURIComponent(resetUrl)}`
  );
}

export async function adminUpdateUserProfileAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    email: String(formData.get("email") || "").toLowerCase(),
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    role: String(formData.get("role") || ""),
    status: String(formData.get("status") || ""),
    verified: String(formData.get("verified") || ""),
    reason: String(formData.get("reason") || "")
  });

  if (!parsed.success) {
    redirectWithToast(`/admin/users/${String(formData.get("userId") || "")}`, "Invalid user data.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast(`/admin/users/${user.id}`, "User is deleted. Re-enable first.", "error");
    return;
  }

  if (parsed.data.userId === admin.id && parsed.data.role !== "ADMIN") {
    redirectWithToast(`/admin/users/${user.id}`, "You cannot remove your own admin role.", "error");
    return;
  }

  if (parsed.data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      redirectWithToast(`/admin/users/${user.id}`, "Email already in use.", "error");
      return;
    }
  }

  const verified = parsed.data.verified === "true";
  if (parsed.data.status === "ACTIVE" && !verified) {
    redirectWithToast(`/admin/users/${user.id}`, "Active users must be verified.", "error");
    return;
  }

  let nextVerifiedAt = user.emailVerifiedAt;
  if (parsed.data.email !== user.email) {
    nextVerifiedAt = verified ? new Date() : null;
  } else if (verified && !user.emailVerifiedAt) {
    nextVerifiedAt = new Date();
  } else if (!verified) {
    nextVerifiedAt = null;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email: parsed.data.email,
      name: parsed.data.name?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      role: parsed.data.role,
      status: parsed.data.status,
      emailVerifiedAt: nextVerifiedAt,
      deletedAt: parsed.data.status === "DISABLED" ? user.deletedAt ?? new Date() : null
    }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.profile.updated",
    entityType: "User",
    entityId: updated.id,
    metadata: {
      email: updated.email,
      role: updated.role,
      status: updated.status,
      verified: Boolean(updated.emailVerifiedAt),
      reason: parsed.data.reason ?? null
    }
  });

  redirect(`/admin/users/${user.id}?toast=User%20updated.&toastType=success`);
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  );
}

export async function adminUpdateUserRoleAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = updateRoleSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    role: String(formData.get("role") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Invalid role update.", "error");
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { id: parsed.data.userId }
  });
  if (!existing) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (existing.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }

  if (parsed.data.userId === admin.id && parsed.data.role !== "ADMIN") {
    redirectWithToast("/admin/users", "You cannot remove your own admin role.", "error");
    return;
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.role.updated",
    entityType: "User",
    entityId: updated.id,
    metadata: { email: updated.email, role: updated.role }
  });

  redirect("/admin/users?toast=User%20updated.&toastType=success");
}

export async function adminUpdateUserStatusAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = updateStatusSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    status: String(formData.get("status") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Invalid status update.", "error");
    return;
  }

  if (parsed.data.userId === admin.id && parsed.data.status !== "ACTIVE") {
    redirectWithToast(
      "/admin/users",
      "You cannot change your own status away from ACTIVE.",
      "error"
    );
    return;
  }

  if (parsed.data.status === "DISABLED") {
    const reasonError = requireReason(parsed.data.reason);
    if (reasonError) {
      redirectWithToast("/admin/users", reasonError, "error");
      return;
    }
  }

  // We currently store account status as PENDING/ACTIVE/DISABLED.
  // "INACTIVE" is derived from last-sign-in and is not persisted.
  const nextStatus =
    parsed.data.status === "DISABLED"
      ? ("DISABLED" as const)
      : parsed.data.status === "INACTIVE"
        ? ("ACTIVE" as const)
        : (parsed.data.status as "PENDING" | "ACTIVE");

  const existing = await prisma.user.findUnique({
    where: { id: parsed.data.userId }
  });
  if (!existing) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      status: nextStatus,
      deletedAt: nextStatus === "DISABLED" ? existing.deletedAt ?? new Date() : null
    }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.status.updated",
    entityType: "User",
    entityId: updated.id,
    metadata: { email: updated.email, status: updated.status, reason: parsed.data.reason ?? null }
  });

  if (existing.status !== updated.status) {
    await recordAuditEvent({
      userId: admin.id,
      action: updated.status === "DISABLED" ? "AUTH_USER_DISABLED" : "AUTH_USER_ENABLED",
      entityType: "User",
      entityId: updated.id,
      metadata: { email: updated.email, status: updated.status, reason: parsed.data.reason ?? null }
    });
  }

  if (parsed.data.status === "INACTIVE") {
    redirect("/admin/users?toast=Inactive%20is%20automatic%20(90%2B%20days%20since%20last%20sign-in).&toastType=success");
  }
  redirect("/admin/users?toast=User%20updated.&toastType=success");
}

export async function adminForcePasswordResetAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.status !== "ACTIVE") {
    redirectWithToast("/admin/users", "User must be ACTIVE to reset password.", "error");
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const resetUrl = new URL(`/reset-password?token=${token}`, baseUrl).toString();

  try {
    await sendPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      resetUrl
    });
  } catch (error) {
    redirect(
      `/admin/users/${user.id}?manualLinkType=reset&manualLink=${encodeURIComponent(resetUrl)}`
    );
  }

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.password_reset.forced",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, reason: parsed.data.reason ?? null }
  });

  redirect("/admin/users?toast=Password%20reset%20email%20sent.&toastType=success");
}

export async function adminResendVerificationAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is already verified.", "info");
    return;
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const verifyUrl = new URL(`/verify-email?token=${token}`, baseUrl).toString();

  try {
    await sendVerification({
      userId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      verifyUrl,
      ipAddress: "admin",
      userAgent: "admin"
    });
  } catch (error) {
    redirect(
      `/admin/users/${user.id}?manualLinkType=verification&manualLink=${encodeURIComponent(verifyUrl)}`
    );
  }

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_EMAIL_VERIFICATION_SENT",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, admin: admin.email ?? admin.id, reason: parsed.data.reason ?? null }
  });

  redirect("/admin/users?toast=Verification%20email%20sent.&toastType=success");
}

export async function adminMarkEmailVerifiedAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }
  const reasonError = requireReason(parsed.data.reason);
  if (reasonError) {
    redirectWithToast("/admin/users", reasonError, "error");
    return;
  }


  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is already verified.", "info");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_EMAIL_VERIFIED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, manual: true, reason: parsed.data.reason ?? null }
  });

  redirect("/admin/users?toast=Email%20marked%20verified.&toastType=success");
}

export async function adminCompleteOnboardingAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const reasonError = requireReason(parsed.data.reason);
  if (reasonError) {
    redirectWithToast("/admin/users", reasonError, "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "ACTIVE",
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      deletedAt: null
    }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_APPROVED",
    entityType: "User",
    entityId: updated.id,
    metadata: { email: updated.email, manual: true, reason: parsed.data.reason ?? null }
  });

  redirect("/admin/users?toast=Onboarding%20completed.&toastType=success");
}

export async function adminGenerateVerificationLinkAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const reasonError = requireReason(parsed.data.reason);
  if (reasonError) {
    redirectWithToast("/admin/users", reasonError, "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const verifyUrl = new URL(`/verify-email?token=${token}`, getBaseUrl()).toString();

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_EMAIL_VERIFICATION_SENT",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      manual: true,
      method: "link",
      reason: parsed.data.reason ?? null
    }
  });

  redirect(
    `/admin/users/${user.id}?manualLinkType=verification&manualLink=${encodeURIComponent(verifyUrl)}`
  );
}

export async function adminGeneratePasswordResetLinkAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const reasonError = requireReason(parsed.data.reason);
  if (reasonError) {
    redirectWithToast("/admin/users", reasonError, "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const resetUrl = new URL(`/reset-password?token=${token}`, getBaseUrl()).toString();

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      manual: true,
      method: "link",
      reason: parsed.data.reason ?? null
    }
  });

  redirect(
    `/admin/users/${user.id}?manualLinkType=reset&manualLink=${encodeURIComponent(resetUrl)}`
  );
}

export async function adminSendApprovalEmailAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.status !== "ACTIVE") {
    redirectWithToast("/admin/users", "User must be ACTIVE to send approval email.", "error");
    return;
  }
  if (!user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is not verified.", "error");
    return;
  }

  try {
    await sendAccountApprovedEmail({
      recipientEmail: user.email,
      recipientName: user.name
    });
  } catch (error) {
    redirectWithToast("/admin/users", "Approval email failed to send.", "error");
    return;
  }

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_APPROVED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, resend: true, template: "approved" }
  });

  redirect("/admin/users?toast=Approval%20email%20sent.&toastType=success");
}

export async function adminSendWelcomeEmailAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.status !== "ACTIVE") {
    redirectWithToast("/admin/users", "User must be ACTIVE to send welcome email.", "error");
    return;
  }
  if (!user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is not verified.", "error");
    return;
  }

  try {
    await sendWelcomeEmail({
      recipientEmail: user.email,
      recipientName: user.name
    });
  } catch (error) {
    redirectWithToast("/admin/users", "Welcome email failed to send.", "error");
    return;
  }

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_APPROVED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, resend: true, template: "welcome" }
  });

  redirect("/admin/users?toast=Welcome%20email%20sent.&toastType=success");
}

export async function adminSendRejectionEmailAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }
  if (user.deletedAt) {
    redirectWithToast("/admin/users", "User is deleted. Re-enable first.", "error");
    return;
  }
  if (user.status !== "DISABLED") {
    redirectWithToast("/admin/users", "User must be DISABLED to send rejection email.", "error");
    return;
  }

  try {
    await sendAccountRejectedEmail({
      recipientEmail: user.email,
      recipientName: user.name
    });
  } catch (error) {
    redirectWithToast("/admin/users", "Rejection email failed to send.", "error");
    return;
  }

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_REJECTED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, resend: true, template: "rejected" }
  });

  redirect("/admin/users?toast=Rejection%20email%20sent.&toastType=success");
}

export async function adminDeleteUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/users", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") || ""),
    reason: String(formData.get("reason") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
    return;
  }

  const reasonError = requireReason(parsed.data.reason);
  if (reasonError) {
    redirectWithToast("/admin/users", reasonError, "error");
    return;
  }

  if (parsed.data.userId === admin.id) {
    redirectWithToast("/admin/users", "You cannot delete your own account.", "error");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    redirectWithToast("/admin/users", "User not found.", "error");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "DISABLED", deletedAt: new Date() }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.deleted",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, reason: parsed.data.reason ?? null }
  });

  redirect("/admin/users?toast=User%20disabled%20(deleted).&toastType=success");
}

