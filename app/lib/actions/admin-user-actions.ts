"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { validateCsrf } from "@/app/lib/auth/csrf";
import { hashResetToken } from "@/app/lib/auth/password-reset";
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
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "DISABLED"])
});

const userIdSchema = z.object({
  userId: z.string().min(1)
});

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
    status: String(formData.get("status") || "")
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
    data: { status: nextStatus }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.status.updated",
    entityType: "User",
    entityId: updated.id,
    metadata: { email: updated.email, status: updated.status }
  });

  if (existing.status !== updated.status) {
    await recordAuditEvent({
      userId: admin.id,
      action: updated.status === "DISABLED" ? "AUTH_USER_DISABLED" : "AUTH_USER_ENABLED",
      entityType: "User",
      entityId: updated.id,
      metadata: { email: updated.email, status: updated.status }
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

  await sendPasswordResetEmail({
    recipientEmail: user.email,
    recipientName: user.name,
    resetUrl
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.password_reset.forced",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email }
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

  await sendVerification({
    userId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    verifyUrl,
    ipAddress: "admin",
    userAgent: "admin"
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "AUTH_EMAIL_VERIFICATION_SENT",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, admin: admin.email ?? admin.id }
  });

  redirect("/admin/users?toast=Verification%20email%20sent.&toastType=success");
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
  if (user.status !== "ACTIVE") {
    redirectWithToast("/admin/users", "User must be ACTIVE to send approval email.", "error");
    return;
  }
  if (!user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is not verified.", "error");
    return;
  }

  await sendAccountApprovedEmail({
    recipientEmail: user.email,
    recipientName: user.name
  });

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
  if (user.status !== "ACTIVE") {
    redirectWithToast("/admin/users", "User must be ACTIVE to send welcome email.", "error");
    return;
  }
  if (!user.emailVerifiedAt) {
    redirectWithToast("/admin/users", "User email is not verified.", "error");
    return;
  }

  await sendWelcomeEmail({
    recipientEmail: user.email,
    recipientName: user.name
  });

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
  if (user.status !== "DISABLED") {
    redirectWithToast("/admin/users", "User must be DISABLED to send rejection email.", "error");
    return;
  }

  await sendAccountRejectedEmail({
    recipientEmail: user.email,
    recipientName: user.name
  });

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
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/users", "Missing user id.", "error");
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

  await prisma.user.delete({ where: { id: user.id } });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.user.deleted",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email }
  });

  redirect("/admin/users?toast=User%20deleted.&toastType=success");
}

