import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const aircraftSchema = z.object({
  tailNumber: z.string().min(1),
  model: z.string().optional()
});

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = await request.json();
  const parsed = aircraftSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid aircraft details." }, { status: 400 });
  }

  const created = await prisma.aircraft.create({
    data: {
      userId: user.id,
      tailNumber: parsed.data.tailNumber.trim(),
      model: parsed.data.model?.trim() || null
    },
    select: { id: true, tailNumber: true, model: true }
  });

  return NextResponse.json(created, { status: 201 });
}
