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
    select: { id: true, userId: true }
  });

  if (!flight) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const participantId = String(formData.get("participantId") ?? "").trim();
  if (!participantId) {
    return NextResponse.json(
      { error: "Participant selection is required." },
      { status: 400 }
    );
  }

  const participant = await prisma.flightParticipant.findFirst({
    where: { id: participantId, flightId: flight.id },
    select: { id: true, userId: true }
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }
  if (participant.userId === flight.userId) {
    const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
    redirectUrl.searchParams.set(
      "toast",
      "The flight owner must remain a participant."
    );
    redirectUrl.searchParams.set("toastType", "error");
    return NextResponse.redirect(redirectUrl);
  }

  await prisma.flightParticipant.delete({ where: { id: participant.id } });

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Participant removed.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
