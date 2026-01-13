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
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const redirectWithToast = (
    message: string,
    toastType: "success" | "error",
    fallbackPath: string
  ) => {
    const origin = new URL(request.url).origin;
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const redirectUrl =
      refererUrl && refererUrl.origin === origin ? refererUrl : new URL(fallbackPath, request.url);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return wantsJson
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : redirectWithToast("Flight not found.", "error", "/flights");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return wantsJson
      ? NextResponse.json(
          { error: "Upload too large or malformed form data." },
          { status: 400 }
        )
      : redirectWithToast(
          "Upload too large or malformed. Try a smaller file (max 20MB each).",
          "error",
          `/flights/${flight.id}/costs`
        );
  }
  const raw = Object.fromEntries(formData.entries());
  const parsed = costItemSchema.safeParse(raw);
  if (!parsed.success) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost data." }, { status: 400 })
      : redirectWithToast("Invalid cost data.", "error", `/flights/${flight.id}/costs`);
  }
  const normalizedCategory = parsed.data.category.trim().toLowerCase();
  const isKnownCategory = costCategoryValues.includes(
    normalizedCategory as (typeof costCategoryValues)[number]
  );
  if (!isKnownCategory && !parsed.data.costItemId) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost category." }, { status: 400 })
      : redirectWithToast("Invalid cost category.", "error", `/flights/${flight.id}/costs`);
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
    return wantsJson
      ? NextResponse.json({ error: "Invalid rate." }, { status: 400 })
      : redirectWithToast("Invalid rate.", "error", `/flights/${flight.id}/costs`);
  }
  if (quantityHoursRaw && quantityHours === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid hours." }, { status: 400 })
      : redirectWithToast("Invalid hours.", "error", `/flights/${flight.id}/costs`);
  }
  if (fuelGallonsRaw && fuelGallons === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid fuel gallons." }, { status: 400 })
      : redirectWithToast("Invalid fuel gallons.", "error", `/flights/${flight.id}/costs`);
  }
  if (fuelPriceRaw && fuelPriceCents === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid fuel price." }, { status: 400 })
      : redirectWithToast("Invalid fuel price.", "error", `/flights/${flight.id}/costs`);
  }

  if (
    (rateCents !== null || quantityHours !== null) &&
    (rateCents === null || quantityHours === null)
  ) {
    return wantsJson
      ? NextResponse.json(
          { error: "Rate and hours are required together." },
          { status: 400 }
        )
      : redirectWithToast(
          "Rate and hours are required together.",
          "error",
          `/flights/${flight.id}/costs`
        );
  }

  if (
    (fuelGallons !== null || fuelPriceCents !== null) &&
    (fuelGallons === null || fuelPriceCents === null)
  ) {
    return wantsJson
      ? NextResponse.json(
          { error: "Fuel gallons and price are required together." },
          { status: 400 }
        )
      : redirectWithToast(
          "Fuel gallons and price are required together.",
          "error",
          `/flights/${flight.id}/costs`
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
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost amount." }, { status: 400 })
      : redirectWithToast("Invalid cost amount.", "error", `/flights/${flight.id}/costs`);
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost date." }, { status: 400 })
      : redirectWithToast("Invalid cost date.", "error", `/flights/${flight.id}/costs`);
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
      return wantsJson
        ? NextResponse.json({ error: "Not found." }, { status: 404 })
        : redirectWithToast("Cost item not found.", "error", `/flights/${flight.id}/costs`);
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

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/flights/${flight.id}/costs`, request.url);
  redirectUrl.searchParams.set(
    "toast",
    isUpdate ? "Cost item updated." : "Cost item added."
  );
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
