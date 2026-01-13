import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getUploadPath } from "@/app/lib/storage";
import { handleApiError } from "@/src/lib/security/errors";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
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

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      return NextResponse.json({ error: "File missing." }, { status: 404 });
    }

    const safeFilename = doc.originalFilename.replace(/["\\]/g, "");
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": doc.contentType ?? "application/octet-stream",
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `inline; filename="${safeFilename}"`
      }
    });
  } catch (error) {
    return handleApiError(error, "aircraft.documents.view");
  }
}

