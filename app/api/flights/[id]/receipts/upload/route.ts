import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import {
  MAX_UPLOAD_BYTES,
  getReceiptExtensionFrom,
  storeUpload
} from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";
import { buildRedirectUrl } from "@/app/lib/http";

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
    const redirectUrl = buildRedirectUrl(request, fallbackPath);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return wantsJson
      ? NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      : redirectWithToast("Unauthorized.", "error", "/login");
  }
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
  } catch {
    return wantsJson
      ? NextResponse.json(
          { error: "Upload too large or malformed form data." },
          { status: 400 }
        )
      : redirectWithToast(
          "Upload too large or malformed. Try a smaller file (max 20MB each).",
          "error",
          `/flights/${flight.id}`
        );
  }
  const kindRaw = formData.get("kind");
  const kind = typeof kindRaw === "string" ? kindRaw.trim().toLowerCase() : "receipt";
  const isPhotoUpload = kind === "photo";
  const costItemIdRaw = formData.get("costItemId");
  const costItemId =
    typeof costItemIdRaw === "string" && costItemIdRaw.trim()
      ? costItemIdRaw
      : null;
  if (isPhotoUpload && costItemId) {
    return wantsJson
      ? NextResponse.json(
          { error: "Photos cannot be linked to a cost item." },
          { status: 400 }
        )
      : redirectWithToast(
          "Photos cannot be linked to a cost item.",
          "error",
          `/flights/${flight.id}`
        );
  }
  if (!isPhotoUpload && costItemId) {
    const costItem = await prisma.costItem.findFirst({
      where: { id: costItemId, userId: user.id, flightId: flight.id },
      select: { id: true }
    });
    if (!costItem) {
      return wantsJson
        ? NextResponse.json(
            { error: "Invalid cost item selection." },
            { status: 400 }
          )
        : redirectWithToast(
            "Invalid cost item selection.",
            "error",
            `/flights/${flight.id}/costs`
          );
    }
  }
  const files = formData
    .getAll("receipts")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return wantsJson
      ? NextResponse.json({ error: "No files uploaded." }, { status: 400 })
      : redirectWithToast("No files uploaded.", "error", `/flights/${flight.id}`);
  }

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return wantsJson
        ? NextResponse.json(
            { error: `File exceeds size limit (${MAX_UPLOAD_BYTES} bytes).` },
            { status: 400 }
          )
        : redirectWithToast(
            "File exceeds size limit (20MB each).",
            "error",
            isPhotoUpload ? `/flights/${flight.id}` : `/flights/${flight.id}/costs`
          );
    }
    if (isPhotoUpload && !file.type.startsWith("image/")) {
      return wantsJson
        ? NextResponse.json(
            { error: "Photos must be an image file." },
            { status: 400 }
          )
        : redirectWithToast(
            "Photos must be an image file.",
            "error",
            `/flights/${flight.id}`
          );
    }
    const extension = getReceiptExtensionFrom(file.type, file.name);
    if (!extension) {
      return wantsJson
        ? NextResponse.json(
            { error: `Unsupported file type (${file.type || "unknown"}).` },
            { status: 400 }
          )
        : redirectWithToast(
            `Unsupported file type (${file.type || "unknown"}).`,
            "error",
            isPhotoUpload ? `/flights/${flight.id}` : `/flights/${flight.id}/costs`
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
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
