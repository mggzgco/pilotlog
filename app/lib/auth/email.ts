import nodemailer from "nodemailer";

type ApprovalEmailInput = {
  approverEmail: string;
  applicantName: string | null;
  applicantEmail: string;
  applicantPhone: string | null;
  approveUrl: string;
  rejectUrl: string;
};

type PasswordResetEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
  resetUrl: string;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error("SMTP_HOST is not configured.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && pass ? { user, pass } : undefined
  });
}

export async function sendApprovalEmail(payload: ApprovalEmailInput) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@flighttraks.app";
  if (!from) {
    throw new Error("SMTP_FROM is not configured.");
  }

  const transporter = getTransport();

  const subject = `Account approval requested for ${payload.applicantEmail}`;
  const text = [
    "A new pilot account is awaiting approval.",
    "",
    `Name: ${payload.applicantName ?? "N/A"}`,
    `Email: ${payload.applicantEmail}`,
    `Phone: ${payload.applicantPhone ?? "N/A"}`,
    "",
    `Approve: ${payload.approveUrl}`,
    `Reject: ${payload.rejectUrl}`
  ].join("\n");

  await transporter.sendMail({
    from,
    to: payload.approverEmail,
    subject,
    text
  });
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailInput) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@flighttraks.app";
  if (!from) {
    throw new Error("SMTP_FROM is not configured.");
  }

  const transporter = getTransport();

  const subject = "Reset your FlightTraks password";
  const text = [
    `Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},`,
    "",
    "We received a request to reset your FlightTraks password.",
    "Use the link below to set a new password. This link expires in 60 minutes.",
    "",
    payload.resetUrl,
    "",
    "If you did not request this, you can safely ignore this email."
  ].join("\n");

  await transporter.sendMail({
    from,
    to: payload.recipientEmail,
    subject,
    text
  });
}
