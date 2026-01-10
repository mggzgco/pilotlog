import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const costItemId = formData.get("costItemId");
  if (!costItemId || typeof costItemId !== "string") {
    return NextResponse.json({ error: "Missing cost item." }, { status: 400 });
  }

  const costItem = await prisma.costItem.findFirst({
    where: { id: costItemId, userId: user.id, flightId: flight.id },
    select: { id: true }
  });

  if (!costItem) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.costItem.delete({ where: { id: costItem.id } });

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/flights/${flight.id}/costs`, request.url);
  redirectUrl.searchParams.set("toast", "Cost item deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
