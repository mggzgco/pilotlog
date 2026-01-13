import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { buildRedirectUrl } from "@/app/lib/http";

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
    const redirectUrl = buildRedirectUrl(request, fallbackPath);
    redirectUrl.searchParams.set("toast", message);
    redirectUrl.searchParams.set("toastType", toastType);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  };

  const user = await requireUser();
  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  if (!flight) {
    return wantsJson
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : redirectWithToast("Flight not found.", "error", "/flights");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return wantsJson
      ? NextResponse.json({ error: "Malformed form data." }, { status: 400 })
      : redirectWithToast("Malformed request.", "error", `/flights/${flight.id}/costs`);
  }

  const costItemId = formData.get("costItemId");
  if (!costItemId || typeof costItemId !== "string") {
    return wantsJson
      ? NextResponse.json({ error: "Missing cost item." }, { status: 400 })
      : redirectWithToast("Missing cost item.", "error", `/flights/${flight.id}/costs`);
  }

  const costItem = await prisma.costItem.findFirst({
    where: { id: costItemId, userId: user.id, flightId: flight.id },
    select: { id: true }
  });

  if (!costItem) {
    return wantsJson
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : redirectWithToast("Cost item not found.", "error", `/flights/${flight.id}/costs`);
  }

  await prisma.costItem.delete({ where: { id: costItem.id } });
  return redirectWithToast("Cost item deleted.", "success", `/flights/${flight.id}/costs`);
}
