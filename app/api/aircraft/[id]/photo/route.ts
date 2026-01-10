import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getUploadPath } from "@/app/lib/storage";
import { handleApiError } from "@/src/lib/security/errors";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, session } = await getCurrentUser();
    if (!user || !session || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const aircraft = await prisma.aircraft.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        photoStoragePath: true,
        photoContentType: true,
        photoOriginalFilename: true
      }
    });

    if (!aircraft) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (!aircraft.photoStoragePath) {
      return NextResponse.json({ error: "No photo." }, { status: 404 });
    }

    const filePath = getUploadPath(aircraft.photoStoragePath);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid photo path." }, { status: 400 });
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      return NextResponse.json({ error: "File missing." }, { status: 404 });
    }

    const safeFilename = (aircraft.photoOriginalFilename ?? "aircraft-photo").replace(
      /["\\]/g,
      ""
    );
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": aircraft.photoContentType ?? "application/octet-stream",
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `inline; filename="${safeFilename}"`
      }
    });
  } catch (error) {
    return handleApiError(error, "aircraft.photo");
  }
}

