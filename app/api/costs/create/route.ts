import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { costCategoryValues } from "@/app/lib/costs/categories";
import {
  parseAmountToCents,
  parseOptionalAmountToCents,
  parseOptionalQuantity
} from "@/app/lib/costs/utils";
import { MAX_UPLOAD_BYTES, getReceiptExtensionFrom, storeUpload } from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

const costCreateSchema = z.object({
  category: z.string().min(1),
  amount: z.string().optional(),
  rate: z.string().optional(),
  quantityHours: z.string().optional(),
  fuelGallons: z.string().optional(),
  fuelPrice: z.string().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().min(1),
  flightId: z.string().min(1)
});

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const origin = new URL(request.url).origin;
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const redirectUrl =
      refererUrl && refererUrl.origin === origin ? refererUrl : new URL("/costs", request.url);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return redirectWithToast(csrf.error ?? "CSRF validation failed.", "error");
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return wantsJson
      ? NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      : redirectWithToast("Unauthorized.", "error");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return wantsJson
      ? NextResponse.json(
          { error: "Upload too large or malformed form data." },
          { status: 400 }
        )
      : redirectWithToast(
          "Upload too large or malformed. Try a smaller file (max 20MB each).",
          "error"
        );
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = costCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost data." }, { status: 400 })
      : redirectWithToast("Invalid cost data.", "error");
  }

  const normalizedCategory = parsed.data.category.trim().toLowerCase();
  const isKnownCategory = costCategoryValues.includes(
    normalizedCategory as (typeof costCategoryValues)[number]
  );

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
      : redirectWithToast("Invalid rate.", "error");
  }
  if (quantityHoursRaw && quantityHours === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid hours." }, { status: 400 })
      : redirectWithToast("Invalid hours.", "error");
  }
  if (fuelGallonsRaw && fuelGallons === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid fuel gallons." }, { status: 400 })
      : redirectWithToast("Invalid fuel gallons.", "error");
  }
  if (fuelPriceRaw && fuelPriceCents === null) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid fuel price." }, { status: 400 })
      : redirectWithToast("Invalid fuel price.", "error");
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
      : redirectWithToast("Rate and hours are required together.", "error");
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
      : redirectWithToast("Fuel gallons and price are required together.", "error");
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
      : redirectWithToast("Invalid cost amount.", "error");
  }

  const parsedDate = new Date(parsed.data.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid cost date." }, { status: 400 })
      : redirectWithToast("Invalid cost date.", "error");
  }

  const flight = await prisma.flight.findFirst({
    where: { id: parsed.data.flightId, userId: user.id },
    select: { id: true }
  });
  if (!flight) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid flight selection." }, { status: 400 })
      : redirectWithToast("Invalid flight selection.", "error");
  }

  const costItem = await prisma.costItem.create({
    data: {
      userId: user.id,
      flightId: flight.id,
      category: isKnownCategory ? normalizedCategory : parsed.data.category,
      amountCents,
      rateCents,
      quantityHours,
      fuelGallons,
      fuelPriceCents,
      vendor: parsed.data.vendor?.trim() ? parsed.data.vendor.trim() : null,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      date: parsedDate
    }
  });

  const files = formData
    .getAll("receipts")
    .filter((value): value is File => value instanceof File && value.size > 0);

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return wantsJson
        ? NextResponse.json(
            { error: `File exceeds size limit (${MAX_UPLOAD_BYTES} bytes).` },
            { status: 400 }
          )
        : redirectWithToast("File exceeds size limit (20MB each).", "error");
    }
    const extension = getReceiptExtensionFrom(file.type, file.name);
    if (!extension) {
      return wantsJson
        ? NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
        : redirectWithToast("Unsupported file type.", "error");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await storeUpload(buffer, extension);

    const receipt = await prisma.receiptDocument.create({
      data: {
        userId: user.id,
        flightId: flight.id,
        costItemId: costItem.id,
        originalFilename: file.name,
        storagePath,
        contentType: file.type,
        sizeBytes: file.size
      }
    });

    await recordAuditEvent({
      userId: user.id,
      action: "receipt_uploaded",
      entityType: "ReceiptDocument",
      entityId: receipt.id,
      metadata: {
        flightId: flight.id,
        originalFilename: file.name,
        sizeBytes: file.size
      }
    });
  }

  return redirectWithToast("Cost saved.", "success");
}

