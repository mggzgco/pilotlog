import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { MAX_UPLOAD_BYTES, getReceiptExtensionFrom, storeUpload } from "@/app/lib/storage";
import { recordAuditEvent } from "@/app/lib/audit";

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

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return wantsJson
      ? NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      : redirectWithToast("Unauthorized.", "error", "/login");
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!aircraft) {
    return wantsJson
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : redirectWithToast("Aircraft not found.", "error", "/aircraft");
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
          `/aircraft/${aircraft.id}`
        );
  }
  const files = formData
    .getAll("documents")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return wantsJson
      ? NextResponse.json({ error: "No files uploaded." }, { status: 400 })
      : redirectWithToast("No files uploaded.", "error", `/aircraft/${aircraft.id}`);
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
            `/aircraft/${aircraft.id}`
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
            `/aircraft/${aircraft.id}`
          );
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

