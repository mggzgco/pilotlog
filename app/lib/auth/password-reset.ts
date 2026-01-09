import crypto from "crypto";
import { prisma } from "@/app/lib/db";
import { hashPassword } from "@/app/lib/password";
import { sendPasswordResetEmail } from "@/app/lib/auth/email";
import {
  consumePasswordResetAttempt,
  formatPasswordResetRateLimitError
} from "@/app/lib/auth/rate-limit";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createResetToken() {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
  };
}

export async function requestPasswordReset({
  email,
  ipAddress
}: {
  email: string;
  ipAddress: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const limiter = consumePasswordResetAttempt({ ipAddress, email: normalizedEmail });
  if (!limiter.allowed) {
    return { error: formatPasswordResetRateLimitError(limiter.resetAt) };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status !== "ACTIVE") {
    return { success: "If the email exists, a reset link will be sent." };
  }

  const { token, tokenHash, expiresAt } = createResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const resetUrl = new URL(`/reset-password?token=${token}`, baseUrl).toString();

  try {
    await sendPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      resetUrl
    });
  } catch (error) {
    console.error("Failed to send password reset email", error);
  }

  return { success: "If the email exists, a reset link will be sent." };
}

export async function validatePasswordResetToken(token: string) {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { valid: false };
  }

  if (record.user.status !== "ACTIVE") {
    return { valid: false };
  }

  return { valid: true, record };
}

export async function resetPassword({
  token,
  password
}: {
  token: string;
  password: string;
}) {
  const validation = await validatePasswordResetToken(token);
  if (!validation.valid || !validation.record) {
    return { error: "Token invalid or expired." };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: validation.record.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: validation.record.id },
      data: { usedAt: new Date() }
    }),
    prisma.session.deleteMany({
      where: { userId: validation.record.userId }
    })
  ]);

  return { success: "Password reset. Please log in." };
}
