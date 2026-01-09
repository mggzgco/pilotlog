import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { getUploadPath } from "@/app/lib/storage";

export async function GET(
  _request: Request,
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

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    return NextResponse.json({ error: "File missing." }, { status: 404 });
  }

  const safeFilename = receipt.originalFilename.replace(/["\\]/g, "");
  const stream = createReadStream(filePath);

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": receipt.contentType ?? "application/octet-stream",
      "Content-Length": stats.size.toString(),
      "Content-Disposition": `attachment; filename="${safeFilename}"`
    }
  });
}
