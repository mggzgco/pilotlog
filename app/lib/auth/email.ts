import nodemailer from "nodemailer";

type ApprovalEmailInput = {
  approverEmail: string;
  applicantName: string | null;
  applicantEmail: string;
  applicantPhone: string | null;
  approveUrl: string;
  rejectUrl: string;
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
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@pilotlog.app";
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
