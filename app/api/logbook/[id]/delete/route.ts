import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const entry = await prisma.logbookEntry.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin ? refererUrl : new URL("/logbook", request.url);

  if (!entry) {
    redirectUrl.searchParams.set("toast", "Logbook entry not found.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  await prisma.logbookEntry.delete({ where: { id: entry.id } });

  redirectUrl.searchParams.set("toast", "Logbook entry deleted.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

