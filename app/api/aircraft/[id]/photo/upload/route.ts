import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { getUploadPath, getReceiptExtension, storeUpload, MAX_UPLOAD_BYTES } from "@/app/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    const origin = new URL(request.url).origin;
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const redirectUrl =
      refererUrl && refererUrl.origin === origin
        ? refererUrl
        : new URL(`/aircraft/${params.id}`, request.url);
    redirectUrl.searchParams.set("toast", csrf.error);
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, photoStoragePath: true }
  });

  if (!aircraft) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds size limit." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Photo must be an image file." }, { status: 400 });
  }

  const extension = getReceiptExtension(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await storeUpload(buffer, extension, { prefix: "aircraft_" });

  await prisma.aircraft.update({
    where: { id: aircraft.id },
    data: {
      photoStoragePath: storagePath,
      photoOriginalFilename: file.name,
      photoContentType: file.type,
      photoSizeBytes: file.size
    }
  });

  if (aircraft.photoStoragePath) {
    const oldPath = getUploadPath(aircraft.photoStoragePath);
    if (oldPath) {
      try {
        await fs.unlink(oldPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/aircraft/${aircraft.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Aircraft photo updated.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}

