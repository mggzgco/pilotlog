"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { costSchema } from "@/app/lib/validation";
import { parseAmountToCents } from "@/app/lib/costs/utils";

export async function createCostAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = costSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid cost data." };
  }

  const amountCents = parseAmountToCents(parsed.data.amount);
  if (amountCents === null) {
    return { error: "Invalid cost amount." };
  }

  const user = await requireUser();

  await prisma.costItem.create({
    data: {
      userId: user.id,
      category: parsed.data.category,
      amountCents,
      vendor: parsed.data.vendor ?? null,
      notes: parsed.data.notes ?? null,
      date: new Date(parsed.data.date)
    }
  });

  // COST-001: record training expenses with receipts
  // COST-002: associate receipts with cost entries
  redirect("/costs");
}
