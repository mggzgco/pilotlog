"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function createAircraftAction(formData: FormData) {
  const tailNumber = String(formData.get("tailNumber") || "").trim();
  const model = String(formData.get("model") || "").trim();

  if (!tailNumber) {
    return { error: "Tail number is required." };
  }

  const user = await requireUser();

  await prisma.aircraft.create({
    data: {
      userId: user.id,
      tailNumber,
      model: model || null
    }
  });

  redirect("/aircraft");
}
