import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";
import { participantRoleOptions } from "@/app/lib/flights/participants";

const roleSet = new Set(participantRoleOptions);

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
  const participantId = String(formData.get("participantId") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "").trim();
  if (
    !participantId ||
    !roleSet.has(roleInput as (typeof participantRoleOptions)[number])
  ) {
    return NextResponse.json(
      { error: "Invalid participant selection." },
      { status: 400 }
    );
  }

  const participant = await prisma.flightParticipant.findFirst({
    where: { id: participantId, flightId: flight.id },
    select: { id: true }
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  await prisma.flightParticipant.update({
    where: { id: participant.id },
    data: { role: roleInput as (typeof participantRoleOptions)[number] }
  });

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Participant role updated.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
