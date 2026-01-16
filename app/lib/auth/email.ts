import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

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

type VerificationEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
  verifyUrl: string;
};

type AccountStatusEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
};

type RejectionEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
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

function getFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "FlightTraks <No_Reply@flighttraks.com>"
  );
}

async function sendEmail(payload: EmailPayload) {
  const from = getFromAddress();
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
}

export function buildApprovalEmail(payload: ApprovalEmailInput) {
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
  const html = `
    <p>A new pilot account is awaiting approval.</p>
    <p><strong>Name:</strong> ${payload.applicantName ?? "N/A"}<br/>
    <strong>Email:</strong> ${payload.applicantEmail}<br/>
    <strong>Phone:</strong> ${payload.applicantPhone ?? "N/A"}</p>
    <p><a href="${payload.approveUrl}">Approve</a> · <a href="${payload.rejectUrl}">Reject</a></p>
  `;
  return { subject, text, html };
}

export function buildVerificationEmail(payload: VerificationEmailInput) {
  const subject = "Verify your FlightTraks email";
  const text = [
    `Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},`,
    "",
    "Please verify your email address to continue your FlightTraks registration.",
    "",
    payload.verifyUrl,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");
  const html = `
    <p>Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},</p>
    <p>Please verify your email address to continue your FlightTraks registration.</p>
    <p><a href="${payload.verifyUrl}">Verify email</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return { subject, text, html };
}

export function buildAccountApprovedEmail(payload: AccountStatusEmailInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const loginUrl = appUrl ? `${appUrl}/login` : "";
  const subject = "Your FlightTraks account is approved";
  const text = [
    `Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},`,
    "",
    "Your FlightTraks account has been approved. You can now sign in.",
    "",
    loginUrl || "Please sign in at the FlightTraks web app."
  ].join("\n");
  const html = `
    <p>Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},</p>
    <p>Your FlightTraks account has been approved. You can now sign in.</p>
    ${loginUrl ? `<p><a href="${loginUrl}">Sign in</a></p>` : ""}
  `;
  return { subject, text, html };
}

export function buildWelcomeEmail(payload: AccountStatusEmailInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const dashboardUrl = appUrl ? `${appUrl}/dashboard` : "";
  const subject = "Welcome to FlightTraks";
  const text = [
    `Welcome${payload.recipientName ? ` ${payload.recipientName}` : ""}!`,
    "",
    "We’re excited to have you on FlightTraks.",
    "",
    dashboardUrl || "Open the FlightTraks web app to get started."
  ].join("\n");
  const html = `
    <p>Welcome${payload.recipientName ? ` ${payload.recipientName}` : ""}!</p>
    <p>We’re excited to have you on FlightTraks.</p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}">Open dashboard</a></p>` : ""}
  `;
  return { subject, text, html };
}

export function buildRejectionEmail(payload: RejectionEmailInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const supportUrl = appUrl ? `${appUrl}/login` : "";
  const subject = "Your FlightTraks account request was not approved";
  const text = [
    `Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},`,
    "",
    "We reviewed your request to access FlightTraks.",
    "At this time, the request was not approved.",
    "",
    supportUrl || "Contact support if you believe this is a mistake."
  ].join("\n");
  const html = `
    <p>Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},</p>
    <p>We reviewed your request to access FlightTraks.</p>
    <p>At this time, the request was not approved.</p>
    ${supportUrl ? `<p>If this is unexpected, please contact support.</p>` : ""}
  `;
  return { subject, text, html };
}

export function buildPasswordResetEmail(payload: PasswordResetEmailInput) {
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
  const html = `
    <p>Hello${payload.recipientName ? ` ${payload.recipientName}` : ""},</p>
    <p>We received a request to reset your FlightTraks password.</p>
    <p><a href="${payload.resetUrl}">Reset password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  return { subject, text, html };
}

export async function sendApprovalEmail(payload: ApprovalEmailInput) {
  const { subject, text, html } = buildApprovalEmail(payload);
  await sendEmail({ to: payload.approverEmail, subject, text, html });
}

export async function sendVerificationEmail(payload: VerificationEmailInput) {
  const { subject, text, html } = buildVerificationEmail(payload);
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendAccountApprovedEmail(payload: AccountStatusEmailInput) {
  const { subject, text, html } = buildAccountApprovedEmail(payload);
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendWelcomeEmail(payload: AccountStatusEmailInput) {
  const { subject, text, html } = buildWelcomeEmail(payload);
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendAccountRejectedEmail(payload: RejectionEmailInput) {
  const { subject, text, html } = buildRejectionEmail(payload);
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailInput) {
  const { subject, text, html } = buildPasswordResetEmail(payload);
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}
