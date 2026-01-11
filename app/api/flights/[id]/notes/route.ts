import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    const origin = new URL(request.url).origin;
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const redirectUrl =
      refererUrl && refererUrl.origin === origin
        ? refererUrl
        : new URL(`/flights/${params.id}`, request.url);
    redirectUrl.searchParams.set("toast", csrf.error ?? "CSRF validation failed.");
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const { user, session } = await getCurrentUser();
  if (!user || !session || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const flight = await prisma.flight.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, statsJson: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" ? notesRaw.trim() : "";
  if (notes.length > 10_000) {
    return NextResponse.json({ error: "Notes are too long." }, { status: 400 });
  }

  const current =
    flight.statsJson &&
    typeof flight.statsJson === "object" &&
    !Array.isArray(flight.statsJson)
      ? (flight.statsJson as Record<string, unknown>)
      : {};

  await prisma.flight.update({
    where: { id: flight.id },
    data: {
      statsJson: {
        ...current,
        userNotes: notes
      }
    }
  });

  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  const refererUrl = referer ? new URL(referer) : null;
  const redirectUrl =
    refererUrl && refererUrl.origin === origin
      ? refererUrl
      : new URL(`/flights/${flight.id}`, request.url);

  redirectUrl.searchParams.set("toast", "Flight notes saved.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}

