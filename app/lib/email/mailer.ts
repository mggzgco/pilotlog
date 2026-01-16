import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

export const mailer = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
});

let verifyPromise: Promise<void> | null = null;
let mailerStatus: { ok: boolean; error?: string; checkedAt?: Date } = {
  ok: false
};

export async function verifyMailer() {
  if (!smtpHost) {
    throw new Error("SMTP_HOST is not configured.");
  }
  if (!verifyPromise) {
    verifyPromise = mailer.verify().then(() => undefined);
  }
  try {
    await verifyPromise;
    mailerStatus = { ok: true, checkedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailer verification failed.";
    mailerStatus = { ok: false, error: message, checkedAt: new Date() };
    throw error;
  }
}

if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  verifyMailer().catch((error) => {
    console.error("Mailer verification failed", error);
  });
}

export function getMailerStatus() {
  return mailerStatus;
}

export async function checkMailerStatus() {
  try {
    await verifyMailer();
    return { ok: true, checkedAt: mailerStatus.checkedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailer verification failed.";
    return { ok: false, error: message, checkedAt: new Date() };
  }
}
