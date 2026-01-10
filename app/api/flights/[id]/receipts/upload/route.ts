import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import {
  MAX_UPLOAD_BYTES,
  getReceiptExtension,
  storeUpload
} from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const kindRaw = formData.get("kind");
  const kind = typeof kindRaw === "string" ? kindRaw.trim().toLowerCase() : "receipt";
  const isPhotoUpload = kind === "photo";
  const costItemIdRaw = formData.get("costItemId");
  const costItemId =
    typeof costItemIdRaw === "string" && costItemIdRaw.trim()
      ? costItemIdRaw
      : null;
  if (isPhotoUpload && costItemId) {
    return NextResponse.json(
      { error: "Photos cannot be linked to a cost item." },
      { status: 400 }
    );
  }
  if (!isPhotoUpload && costItemId) {
    const costItem = await prisma.costItem.findFirst({
      where: { id: costItemId, userId: user.id, flightId: flight.id },
      select: { id: true }
    });
    if (!costItem) {
      return NextResponse.json(
        { error: "Invalid cost item selection." },
        { status: 400 }
      );
    }
  }
  const files = formData
    .getAll("receipts")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds size limit." },
        { status: 400 }
      );
    }
    if (isPhotoUpload && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Photos must be an image file." },
        { status: 400 }
      );
    }
    const extension = getReceiptExtension(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Unsupported file type." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await storeUpload(buffer, extension, {
      prefix: isPhotoUpload ? "photo_" : ""
    });

    const receipt = await prisma.receiptDocument.create({
      data: {
        userId: user.id,
        flightId: flight.id,
        costItemId,
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

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const fallbackPath = isPhotoUpload ? `/flights/${flight.id}` : `/flights/${flight.id}/costs`;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(fallbackPath, request.url);
  redirectUrl.searchParams.set("toast", isPhotoUpload ? "Photos uploaded." : "Receipts uploaded.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
