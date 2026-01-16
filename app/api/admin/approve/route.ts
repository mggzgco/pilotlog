import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { hashApprovalToken } from "@/app/lib/auth/approvals";
import { recordAuditEvent } from "@/app/lib/audit";
import { sendAccountApprovedEmail, sendWelcomeEmail } from "@/app/lib/auth/email";

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

  if (!record || record.expiresAt < new Date() || record.usedAt) {
    return NextResponse.json({ error: "Token expired or invalid." }, { status: 400 });
  }

  if (!record.user.emailVerifiedAt) {
    return NextResponse.json({ error: "User email is not verified yet." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE" }
    }),
    prisma.accountApprovalToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    })
  ]);

  try {
    await sendAccountApprovedEmail({
      recipientEmail: record.user.email,
      recipientName: record.user.name
    });
    await sendWelcomeEmail({
      recipientEmail: record.user.email,
      recipientName: record.user.name
    });
  } catch (error) {
    console.error("Failed to send approval/welcome email", error);
  }

  await recordAuditEvent({
    userId: record.userId,
    action: "AUTH_APPROVED",
    entityType: "User",
    entityId: record.userId,
    ipAddress: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? null,
    userAgent: request.headers.get("user-agent"),
    metadata: { email: record.user.email }
  });

  return NextResponse.redirect(new URL("/login?approved=1", request.url));
}
