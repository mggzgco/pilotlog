import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (!smtpHost) {
  throw new Error("SMTP_HOST is not configured.");
}

export const mailer = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
});

let verifyPromise: Promise<void> | null = null;

export async function verifyMailer() {
  if (!verifyPromise) {
    verifyPromise = mailer.verify().then(() => undefined);
  }
  return verifyPromise;
}

if (process.env.NODE_ENV === "production") {
  verifyMailer().catch((error) => {
    console.error("Mailer verification failed", error);
    throw error;
  });
}
