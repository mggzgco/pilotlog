import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { getUploadPath } from "@/app/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const receipt = await prisma.receiptDocument.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!receipt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = getUploadPath(receipt.storagePath);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid receipt path." }, { status: 400 });
  }

  await prisma.receiptDocument.delete({ where: { id: receipt.id } });

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing file cleanup errors.
  }

  return NextResponse.redirect(new URL(`/flights/${receipt.flightId}`, request.url));
}
