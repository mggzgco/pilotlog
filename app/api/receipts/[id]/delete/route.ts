import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getUploadPath } from "@/app/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return wantsJson
      ? NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  const receipt = await prisma.receiptDocument.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!receipt) {
    return wantsJson
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : NextResponse.redirect(new URL("/flights", request.url), { status: 303 });
  }

  const filePath = getUploadPath(receipt.storagePath);
  if (!filePath) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid receipt path." }, { status: 400 })
      : NextResponse.redirect(new URL(`/flights/${receipt.flightId}`, request.url), {
          status: 303
        });
  }

  await prisma.receiptDocument.delete({ where: { id: receipt.id } });

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing file cleanup errors.
  }

  if (wantsJson) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const isPhoto = receipt.storagePath.startsWith("photo_");
  const fallbackPath = isPhoto ? `/flights/${receipt.flightId}` : `/flights/${receipt.flightId}/costs`;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(fallbackPath, request.url);
  redirectUrl.searchParams.set("toast", "Receipt deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
