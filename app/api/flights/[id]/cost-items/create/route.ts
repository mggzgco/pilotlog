import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { parseAmountToCents } from "@/app/lib/costs/utils";

const costItemSchema = z.object({
  costItemId: z.string().optional(),
  category: z.string().min(1),
  amount: z.string().min(1),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = costItemSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cost data." }, { status: 400 });
  }

  const amountCents = parseAmountToCents(parsed.data.amount);
  if (amountCents === null) {
    return NextResponse.json({ error: "Invalid cost amount." }, { status: 400 });
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid cost date." }, { status: 400 });
  }

  const data = {
    category: parsed.data.category,
    amountCents,
    vendor: parsed.data.vendor ?? null,
    notes: parsed.data.notes ?? null,
    date
  };

  const isUpdate = Boolean(parsed.data.costItemId);
  if (isUpdate) {
    const existing = await prisma.costItem.findFirst({
      where: {
        id: parsed.data.costItemId,
        userId: user.id,
        flightId: flight.id
      },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.costItem.update({
      where: { id: existing.id },
      data
    });
  } else {
    await prisma.costItem.create({
      data: {
        ...data,
        userId: user.id,
        flightId: flight.id
      }
    });
  }

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set(
    "toast",
    isUpdate ? "Cost item updated." : "Cost item added."
  );
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
