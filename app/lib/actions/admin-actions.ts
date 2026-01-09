"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function approveUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const userId = String(formData.get("userId") || "");
  if (!userId) {
    return { error: "Missing user id." };
  }

  // ADMIN-001: approve pending accounts
  await prisma.user.update({
    where: { id: userId },
    data: { approved: true }
  });

  redirect("/admin/approvals");
}
