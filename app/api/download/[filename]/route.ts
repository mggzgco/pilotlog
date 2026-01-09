import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/app/lib/db";
import { getCurrentSession } from "@/app/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const { user } = await getCurrentSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // NFR-SEC-003: enforce per-user authorization on file downloads
  const cost = await prisma.costItem.findFirst({
    where: {
      userId: user.id,
      receiptPath: params.filename
    }
  });

  if (!cost) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploads", params.filename);
  const fileBuffer = await fs.readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=receipt-${params.filename}`
    }
  });
}
