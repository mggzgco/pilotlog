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
import { buildRedirectUrl } from "@/app/lib/http";

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
  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const redirectUrl = buildRedirectUrl(request, "/costs");
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
    return redirectWithToast("Unauthorized.", "error");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectWithToast(
      "Upload too large or malformed. Try a smaller file (max 20MB each).",
      "error"
    );
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = costCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return redirectWithToast("Invalid cost data.", "error");
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
    return redirectWithToast("Invalid rate.", "error");
  }
  if (quantityHoursRaw && quantityHours === null) {
    return redirectWithToast("Invalid hours.", "error");
  }
  if (fuelGallonsRaw && fuelGallons === null) {
    return redirectWithToast("Invalid fuel gallons.", "error");
  }
  if (fuelPriceRaw && fuelPriceCents === null) {
    return redirectWithToast("Invalid fuel price.", "error");
  }

  if (
    (rateCents !== null || quantityHours !== null) &&
    (rateCents === null || quantityHours === null)
  ) {
    return redirectWithToast("Rate and hours are required together.", "error");
  }

  if (
    (fuelGallons !== null || fuelPriceCents !== null) &&
    (fuelGallons === null || fuelPriceCents === null)
  ) {
    return redirectWithToast("Fuel gallons and price are required together.", "error");
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
    return redirectWithToast("Invalid cost amount.", "error");
  }

  const parsedDate = new Date(parsed.data.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return redirectWithToast("Invalid cost date.", "error");
  }

  const flight = await prisma.flight.findFirst({
    where: { id: parsed.data.flightId, userId: user.id },
    select: { id: true }
  });
  if (!flight) {
    return redirectWithToast("Invalid flight selection.", "error");
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
      return redirectWithToast("File exceeds size limit (20MB each).", "error");
    }
    const extension = getReceiptExtensionFrom(file.type, file.name);
    if (!extension) {
      return redirectWithToast("Unsupported file type.", "error");
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

