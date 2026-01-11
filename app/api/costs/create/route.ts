import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { costSchema } from "@/app/lib/validation";
import { parseAmountToCents } from "@/app/lib/costs/utils";
import { MAX_UPLOAD_BYTES, getReceiptExtension, storeUpload } from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(request: Request) {
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
    return redirectWithToast("Unauthorized.", "error");
  }

  const formData = await request.formData();
  const raw = {
    category: String(formData.get("category") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    vendor: typeof formData.get("vendor") === "string" ? formData.get("vendor") : "",
    notes: typeof formData.get("notes") === "string" ? formData.get("notes") : "",
    date: String(formData.get("date") ?? ""),
    flightId: String(formData.get("flightId") ?? "")
  };
  const parsed = costSchema.safeParse(raw);
  if (!parsed.success) {
    return redirectWithToast("Invalid cost data.", "error");
  }

  const amountCents = parseAmountToCents(parsed.data.amount);
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
      category: parsed.data.category,
      amountCents,
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
      return redirectWithToast("File exceeds size limit.", "error");
    }
    const extension = getReceiptExtension(file.type);
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

