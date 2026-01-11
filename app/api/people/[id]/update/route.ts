import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

const personSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const payload = await request.json().catch(() => null);
  const parsed = personSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid person details." }, { status: 400 });
  }

  const existing = await prisma.person.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;
  const linkedUser = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;

  const updated = await prisma.person.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name.trim(),
      email,
      linkedUserId: linkedUser?.id ?? null
    },
    select: { id: true, name: true, email: true, linkedUserId: true }
  });

  return NextResponse.json(updated);
}

