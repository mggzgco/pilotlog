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
  const userId = String(formData.get("userId") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "").trim();
  if (!userId || !roleSet.has(roleInput as (typeof participantRoleOptions)[number])) {
    return NextResponse.json(
      { error: "Invalid participant selection." },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: userId },
    select: { id: true }
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.flightParticipant.upsert({
    where: { flightId_userId: { flightId: flight.id, userId } },
    update: { role: roleInput as (typeof participantRoleOptions)[number] },
    create: {
      flightId: flight.id,
      userId,
      role: roleInput as (typeof participantRoleOptions)[number]
    }
  });

  const redirectUrl = new URL(`/flights/${flight.id}`, request.url);
  redirectUrl.searchParams.set("toast", "Participant updated.");
  redirectUrl.searchParams.set("toastType", "success");
  return NextResponse.redirect(redirectUrl);
}
