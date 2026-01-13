import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { MAX_UPLOAD_BYTES, getReceiptExtension, storeUpload } from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("documents")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds size limit." }, { status: 400 });
    }
    const extension = getReceiptExtension(file.type);
    if (!extension) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await storeUpload(buffer, extension, { prefix: "acdoc_" });

    const doc = await prisma.aircraftDocument.create({
      data: {
        userId: user.id,
        aircraftId: aircraft.id,
        originalFilename: file.name,
        storagePath,
        contentType: file.type,
        sizeBytes: file.size
      }
    });

    await recordAuditEvent({
      userId: user.id,
      action: "aircraft_document.uploaded",
      entityType: "AircraftDocument",
      entityId: doc.id,
      metadata: {
        aircraftId: aircraft.id,
        originalFilename: file.name,
        sizeBytes: file.size
      }
    });
  }

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/aircraft/${aircraft.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Documents uploaded.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

