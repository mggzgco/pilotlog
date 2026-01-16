import crypto from "crypto";
import { prisma } from "@/app/lib/db";
import { recordAuditEvent } from "@/app/lib/audit";
import { sendVerificationEmail } from "@/app/lib/auth/email";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  return { token, tokenHash, expiresAt };
}

export function hashEmailVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendVerification({
  userId,
  recipientEmail,
  recipientName,
  verifyUrl,
  ipAddress,
  userAgent
}: {
  userId: string;
  recipientEmail: string;
  recipientName: string | null;
  verifyUrl: string;
  ipAddress: string;
  userAgent: string;
}) {
  try {
    await sendVerificationEmail({
      recipientEmail,
      recipientName,
      verifyUrl
    });
    await recordAuditEvent({
      userId,
      action: "AUTH_EMAIL_VERIFICATION_SENT",
      entityType: "User",
      entityId: userId,
      ipAddress,
      userAgent,
      metadata: { email: recipientEmail }
    });
  } catch (error) {
    console.error("Failed to send verification email", error);
  }
}

export async function validateVerificationToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });
  if (!record || record.expiresAt < new Date() || record.usedAt) {
    return { valid: false };
  }
  return { valid: true, record };
}

