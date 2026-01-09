"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { costSchema } from "@/app/lib/validation";
import { storeUpload } from "@/app/lib/storage";

export async function createCostAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = costSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid cost data." };
  }

  const user = await requireUser();
  const receipt = formData.get("receipt");
  let receiptPath: string | null = null;

  if (receipt instanceof File && receipt.size > 0) {
    // COST-003: store receipt securely in private uploads
    receiptPath = await storeUpload(receipt);
  }

  await prisma.cost.create({
    data: {
      userId: user.id,
      amount: Number(parsed.data.amount),
      currency: parsed.data.currency,
      description: parsed.data.description ?? null,
      date: new Date(parsed.data.date),
      receiptPath
    }
  });

  // COST-001: record training expenses with receipts
  // COST-002: associate receipts with cost entries
  redirect("/costs");
}
