import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { costCategoryValues } from "@/app/lib/costs/categories";
import {
  parseAmountToCents,
  parseOptionalAmountToCents,
  parseOptionalQuantity
} from "@/app/lib/costs/utils";

const costItemSchema = z.object({
  costItemId: z.string().optional(),
  category: z.string().min(1),
  amount: z.string().optional(),
  rate: z.string().optional(),
  quantityHours: z.string().optional(),
  fuelGallons: z.string().optional(),
  fuelPrice: z.string().optional(),
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
  const normalizedCategory = parsed.data.category.trim().toLowerCase();
  const isKnownCategory = costCategoryValues.includes(
    normalizedCategory as (typeof costCategoryValues)[number]
  );
  if (!isKnownCategory && !parsed.data.costItemId) {
    return NextResponse.json({ error: "Invalid cost category." }, { status: 400 });
  }

  const rateRaw = parsed.data.rate?.trim() ?? "";
  const quantityHoursRaw = parsed.data.quantityHours?.trim() ?? "";
  const fuelGallonsRaw = parsed.data.fuelGallons?.trim() ?? "";
  const fuelPriceRaw = parsed.data.fuelPrice?.trim() ?? "";

  const rateCents = parseOptionalAmountToCents(parsed.data.rate);
  const quantityHours = parseOptionalQuantity(parsed.data.quantityHours);
  const fuelGallons = parseOptionalQuantity(parsed.data.fuelGallons);
  const fuelPriceCents = parseOptionalAmountToCents(parsed.data.fuelPrice);

  if (rateRaw && rateCents === null) {
    return NextResponse.json({ error: "Invalid rate." }, { status: 400 });
  }
  if (quantityHoursRaw && quantityHours === null) {
    return NextResponse.json({ error: "Invalid hours." }, { status: 400 });
  }
  if (fuelGallonsRaw && fuelGallons === null) {
    return NextResponse.json({ error: "Invalid fuel gallons." }, { status: 400 });
  }
  if (fuelPriceRaw && fuelPriceCents === null) {
    return NextResponse.json({ error: "Invalid fuel price." }, { status: 400 });
  }

  if (
    (rateCents !== null || quantityHours !== null) &&
    (rateCents === null || quantityHours === null)
  ) {
    return NextResponse.json(
      { error: "Rate and hours are required together." },
      { status: 400 }
    );
  }

  if (
    (fuelGallons !== null || fuelPriceCents !== null) &&
    (fuelGallons === null || fuelPriceCents === null)
  ) {
    return NextResponse.json(
      { error: "Fuel gallons and price are required together." },
      { status: 400 }
    );
  }

  let amountCents: number | null = null;
  if (rateCents !== null && quantityHours !== null) {
    amountCents = Math.round(rateCents * quantityHours);
  } else if (fuelGallons !== null && fuelPriceCents !== null) {
    amountCents = Math.round(fuelGallons * fuelPriceCents);
  } else if (parsed.data.amount) {
    amountCents = parseAmountToCents(parsed.data.amount);
  }

  if (amountCents === null) {
    return NextResponse.json({ error: "Invalid cost amount." }, { status: 400 });
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid cost date." }, { status: 400 });
  }

  const data = {
    category: isKnownCategory ? normalizedCategory : parsed.data.category,
    amountCents,
    rateCents,
    quantityHours,
    fuelGallons,
    fuelPriceCents,
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
