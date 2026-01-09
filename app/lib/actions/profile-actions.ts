"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function updateProfileAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { name }
  });

  redirect("/profile");
}
