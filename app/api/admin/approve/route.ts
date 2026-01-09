import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { hashApprovalToken } from "@/app/lib/auth/approvals";
import { recordAuditEvent } from "@/app/lib/audit";

const tokenSchema = z.object({
  token: z.string().min(20)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = tokenSchema.safeParse({
    token: searchParams.get("token")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval token." }, { status: 400 });
  }

  const tokenHash = hashApprovalToken(parsed.data.token);
  const record = await prisma.accountApprovalToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token expired or invalid." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE" }
    }),
    prisma.accountApprovalToken.delete({
      where: { id: record.id }
    })
  ]);

  await recordAuditEvent({
    userId: record.userId,
    action: "admin.approve.token",
    entityType: "User",
    entityId: record.userId,
    metadata: { email: record.user.email }
  });

  return NextResponse.redirect(new URL("/login?approved=1", request.url));
}
