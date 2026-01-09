"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { recordAuditEvent } from "@/app/lib/audit";
import { validateCsrf } from "@/app/lib/auth/csrf";

const approvalSchema = z.object({
  userId: z.string().min(1)
});

export async function approveUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    return { error: csrf.error };
  }

  const admin = await requireAdmin();

  const parsed = approvalSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    return { error: "Missing user id." };
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

  redirect("/admin/approvals");
}

export async function rejectUserAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    return { error: csrf.error };
  }

  const admin = await requireAdmin();

  const parsed = approvalSchema.safeParse({
    userId: String(formData.get("userId") || "")
  });
  if (!parsed.success) {
    return { error: "Missing user id." };
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

  redirect("/admin/approvals");
}
