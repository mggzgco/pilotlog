import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getUploadPath } from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const doc = await prisma.aircraftDocument.findFirst({
    where: { id: params.id, userId: user.id }
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = getUploadPath(doc.storagePath);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 400 });
  }

  await prisma.aircraftDocument.delete({ where: { id: doc.id } });

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing file cleanup errors.
  }

  await recordAuditEvent({
    userId: user.id,
    action: "aircraft_document.deleted",
    entityType: "AircraftDocument",
    entityId: doc.id,
    metadata: {
      aircraftId: doc.aircraftId,
      originalFilename: doc.originalFilename,
      sizeBytes: doc.sizeBytes ?? null
    }
  });

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/aircraft/${doc.aircraftId}`, request.url);
  redirectUrl.searchParams.set("toast", "Document deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

