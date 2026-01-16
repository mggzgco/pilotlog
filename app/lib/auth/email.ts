import { prisma } from "@/app/lib/db";
import { sendEmail, getReplyToAddress } from "@/app/lib/email/send-email";
import {
  EMAIL_TEMPLATE_KEYS,
  applyTemplate,
  getDefaultEmailTemplate,
  type EmailTemplateContent,
  type EmailTemplateKey
} from "@/app/lib/auth/email-templates";

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

function getSupportEmail() {
  return (
    process.env.SUPPORT_EMAIL ||
    getReplyToAddress() ||
    "support@flighttraks.com"
  );
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://app.flighttraks.com"
  );
}

function buildContext(values: Record<string, string | number | null | undefined>) {
  const appUrl = getBaseUrl();
  return {
    appUrl,
    logoUrl: `${appUrl}/brand/flighttraks-logo.svg`,
    supportEmail: getSupportEmail(),
    ...values
  };
}

async function resolveTemplate(
  key: EmailTemplateKey,
  context: Record<string, string | number | null | undefined>
): Promise<EmailTemplateContent> {
  const stored = await prisma.emailTemplate.findUnique({ where: { key } });
  const base = stored ?? getDefaultEmailTemplate(key);
  return {
    subject: applyTemplate(base.subject, context),
    html: applyTemplate(base.html, context),
    text: applyTemplate(base.text, context)
  };
}

export function buildApprovalEmail(payload: ApprovalEmailInput) {
  const context = buildContext({
    approverEmail: payload.approverEmail,
    applicantName: payload.applicantName ?? "N/A",
    applicantEmail: payload.applicantEmail,
    applicantPhone: payload.applicantPhone ?? "N/A",
    approveUrl: payload.approveUrl,
    rejectUrl: payload.rejectUrl
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.APPROVAL_REQUEST);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export function buildVerificationEmail(payload: VerificationEmailInput) {
  const context = buildContext({
    name: payload.recipientName ?? "there",
    email: payload.recipientEmail,
    verifyUrl: payload.verifyUrl
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.VERIFY_EMAIL);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export function buildAccountApprovedEmail(payload: AccountStatusEmailInput) {
  const baseUrl = getBaseUrl();
  const context = buildContext({
    name: payload.recipientName ?? "there",
    email: payload.recipientEmail,
    loginUrl: `${baseUrl}/login`
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export function buildWelcomeEmail(payload: AccountStatusEmailInput) {
  const baseUrl = getBaseUrl();
  const context = buildContext({
    name: payload.recipientName ?? "there",
    email: payload.recipientEmail,
    dashboardUrl: `${baseUrl}/dashboard`
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.WELCOME);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export function buildRejectionEmail(payload: RejectionEmailInput) {
  const baseUrl = getBaseUrl();
  const context = buildContext({
    name: payload.recipientName ?? "there",
    email: payload.recipientEmail,
    supportUrl: `${baseUrl}/login`
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export function buildPasswordResetEmail(payload: PasswordResetEmailInput) {
  const context = buildContext({
    name: payload.recipientName ?? "there",
    email: payload.recipientEmail,
    resetUrl: payload.resetUrl
  });
  const base = getDefaultEmailTemplate(EMAIL_TEMPLATE_KEYS.PASSWORD_RESET);
  return {
    subject: applyTemplate(base.subject, context),
    text: applyTemplate(base.text, context),
    html: applyTemplate(base.html, context)
  };
}

export async function sendApprovalEmail(payload: ApprovalEmailInput) {
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.APPROVAL_REQUEST,
    buildContext({
      approverEmail: payload.approverEmail,
      applicantName: payload.applicantName ?? "N/A",
      applicantEmail: payload.applicantEmail,
      applicantPhone: payload.applicantPhone ?? "N/A",
      approveUrl: payload.approveUrl,
      rejectUrl: payload.rejectUrl
    })
  );
  await sendEmail({ to: payload.approverEmail, subject, text, html });
}

export async function sendVerificationEmail(payload: VerificationEmailInput) {
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.VERIFY_EMAIL,
    buildContext({
      name: payload.recipientName ?? "there",
      email: payload.recipientEmail,
      verifyUrl: payload.verifyUrl
    })
  );
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendAccountApprovedEmail(payload: AccountStatusEmailInput) {
  const baseUrl = getBaseUrl();
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED,
    buildContext({
      name: payload.recipientName ?? "there",
      email: payload.recipientEmail,
      loginUrl: `${baseUrl}/login`
    })
  );
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendWelcomeEmail(payload: AccountStatusEmailInput) {
  const baseUrl = getBaseUrl();
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.WELCOME,
    buildContext({
      name: payload.recipientName ?? "there",
      email: payload.recipientEmail,
      dashboardUrl: `${baseUrl}/dashboard`
    })
  );
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendAccountRejectedEmail(payload: RejectionEmailInput) {
  const baseUrl = getBaseUrl();
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED,
    buildContext({
      name: payload.recipientName ?? "there",
      email: payload.recipientEmail,
      supportUrl: `${baseUrl}/login`
    })
  );
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailInput) {
  const { subject, text, html } = await resolveTemplate(
    EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    buildContext({
      name: payload.recipientName ?? "there",
      email: payload.recipientEmail,
      resetUrl: payload.resetUrl
    })
  );
  await sendEmail({ to: payload.recipientEmail, subject, text, html });
}
