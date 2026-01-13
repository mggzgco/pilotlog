"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/audit";
import { validateCsrf } from "@/app/lib/auth/csrf";

function redirectWithToast(
  path: string,
  message: string,
  toastType: "success" | "error" | "info"
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}toast=${encodeURIComponent(message)}&toastType=${toastType}`);
}

const approvalSchema = z.object({
  userId: z.string().min(1)
});

export async function approveUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/approvals", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }

  const admin = await requireAdmin();

  const parsed = approvalSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/approvals", "Missing user id.", "error");
    return;
  }

  // ADMIN-001: approve pending accounts
  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { status: "ACTIVE" }
  });

  await prisma.accountApprovalToken.deleteMany({
    where: { userId: updated.id }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.approve",
    entityType: "User",
    entityId: updated.id,
    metadata: {
      email: updated.email
    }
  });

  redirectWithToast("/admin/approvals", "User approved.", "success");
}

export async function rejectUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/approvals", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }

  const admin = await requireAdmin();

  const parsed = approvalSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    redirectWithToast("/admin/approvals", "Missing user id.", "error");
    return;
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { status: "DISABLED" }
  });

  await prisma.accountApprovalToken.deleteMany({
    where: { userId: updated.id }
  });

  await recordAuditEvent({
    userId: admin.id,
    action: "admin.reject",
    entityType: "User",
    entityId: updated.id,
    metadata: {
      email: updated.email
    }
  });

  redirectWithToast("/admin/approvals", "User rejected.", "success");
}
