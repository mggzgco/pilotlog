import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getUploadPath } from "@/app/lib/storage";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const aircraft = await prisma.aircraft.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, photoStoragePath: true }
  });

  if (!aircraft) {
    const redirectUrl = new URL("/aircraft", request.url);
    redirectUrl.searchParams.set("toast", "Aircraft not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  await prisma.aircraft.delete({ where: { id: aircraft.id } });

  if (aircraft.photoStoragePath) {
    const filePath = getUploadPath(aircraft.photoStoragePath);
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  const redirectUrl = new URL("/aircraft", request.url);
  redirectUrl.searchParams.set("toast", "Aircraft deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

