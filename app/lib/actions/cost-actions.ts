"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { costSchema } from "@/app/lib/validation";
import { parseAmountToCents } from "@/app/lib/costs/utils";
import {
  MAX_UPLOAD_BYTES,
  getReceiptExtension,
  storeUpload
} from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

export async function createCostAction(formData: FormData) {
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
    return { error: "Invalid cost data." };
  }

  const amountCents = parseAmountToCents(parsed.data.amount);
  if (amountCents === null) {
    return { error: "Invalid cost amount." };
  }

  const parsedDate = new Date(parsed.data.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: "Invalid cost date." };
  }

  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: parsed.data.flightId, userId: user.id },
    select: { id: true }
  });
  if (!flight) {
    return { error: "Invalid flight selection." };
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
      return { error: "File exceeds size limit." };
    }
    const extension = getReceiptExtension(file.type);
    if (!extension) {
      return { error: "Unsupported file type." };
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

  // COST-001: record training expenses with receipts
  // COST-002: associate receipts with cost entries
  redirect("/costs?toast=Cost%20saved.&toastType=success");
}
