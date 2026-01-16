"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { validateCsrf } from "@/app/lib/auth/csrf";
import { sendEmail } from "@/app/lib/email/send-email";
import {
  applyTemplate,
  EMAIL_TEMPLATE_KEYS,
  getDefaultEmailTemplate,
  type EmailTemplateKey
} from "@/app/lib/auth/email-templates";

function redirectWithToast(
  path: string,
  message: string,
  toastType: "success" | "error" | "info"
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}toast=${encodeURIComponent(message)}&toastType=${toastType}`);
}

const templateKeySchema = z.enum(Object.values(EMAIL_TEMPLATE_KEYS) as [string, ...string[]]);

const templateSchema = z.object({
  key: templateKeySchema,
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().min(1)
});

const keySchema = z.object({
  key: templateKeySchema
});

const rollbackSchema = z.object({
  versionId: z.string().min(1)
});

const testSchema = z.object({
  key: templateKeySchema,
  email: z.string().email()
});

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://app.flighttraks.com"
  );
}

function extractEmailAddress(value: string | undefined) {
  if (!value) {
    return "";
  }
  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? value;
}

function getSupportEmail() {
  return (
    process.env.SUPPORT_EMAIL ||
    extractEmailAddress(process.env.EMAIL_FROM) ||
    extractEmailAddress(process.env.SMTP_FROM) ||
    process.env.SMTP_USER ||
    "support@flighttraks.com"
  );
}

function buildSampleContext() {
  const appUrl = getBaseUrl();
  return {
    name: "Avery Pilot",
    email: "avery@example.com",
    appUrl,
    logoUrl: `${appUrl}/brand/flighttraks-logo.svg`,
    supportEmail: getSupportEmail(),
    approverEmail: "admin@flighttraks.com",
    applicantName: "Avery Pilot",
    applicantEmail: "avery@example.com",
    applicantPhone: "+1 (555) 555-5555",
    approveUrl: `${appUrl}/api/admin/approve?token=sample`,
    rejectUrl: `${appUrl}/api/admin/reject?token=sample`,
    verifyUrl: `${appUrl}/verify-email?token=sample`,
    loginUrl: `${appUrl}/login`,
    dashboardUrl: `${appUrl}/dashboard`,
    supportUrl: `${appUrl}/login`,
    resetUrl: `${appUrl}/reset-password?token=sample`
  };
}

export async function saveEmailTemplateAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/email-templates", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = templateSchema.safeParse({
    key: String(formData.get("key") || ""),
    subject: String(formData.get("subject") || ""),
    html: String(formData.get("html") || ""),
    text: String(formData.get("text") || "")
  });

  if (!parsed.success) {
    redirectWithToast("/admin/email-templates", "Invalid template data.", "error");
    return;
  }

  const saved = await prisma.emailTemplate.upsert({
    where: { key: parsed.data.key },
    update: {
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text
    },
    create: parsed.data
  });

  await prisma.emailTemplateVersion.create({
    data: {
      templateKey: parsed.data.key,
      subject: saved.subject,
      html: saved.html,
      text: saved.text,
      action: "SAVE",
      createdByUserId: admin.id
    }
  });

  redirectWithToast("/admin/email-templates", "Email template updated.", "success");
}

export async function resetEmailTemplateAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/email-templates", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = keySchema.safeParse({
    key: String(formData.get("key") || "")
  });

  if (!parsed.success) {
    redirectWithToast("/admin/email-templates", "Invalid template key.", "error");
    return;
  }

  await prisma.emailTemplate.deleteMany({ where: { key: parsed.data.key } });
  const defaults = getDefaultEmailTemplate(parsed.data.key as EmailTemplateKey);
  await prisma.emailTemplateVersion.create({
    data: {
      templateKey: parsed.data.key,
      subject: defaults.subject,
      html: defaults.html,
      text: defaults.text,
      action: "RESET",
      createdByUserId: admin.id
    }
  });
  redirectWithToast("/admin/email-templates", "Email template reset to default.", "success");
}

export async function rollbackEmailTemplateAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/email-templates", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  const admin = await requireAdmin();

  const parsed = rollbackSchema.safeParse({
    versionId: String(formData.get("versionId") || "")
  });

  if (!parsed.success) {
    redirectWithToast("/admin/email-templates", "Invalid template version.", "error");
    return;
  }

  const version = await prisma.emailTemplateVersion.findUnique({
    where: { id: parsed.data.versionId }
  });

  if (!version) {
    redirectWithToast("/admin/email-templates", "Template version not found.", "error");
    return;
  }

  const restored = await prisma.emailTemplate.upsert({
    where: { key: version.templateKey },
    update: {
      subject: version.subject,
      html: version.html,
      text: version.text
    },
    create: {
      key: version.templateKey,
      subject: version.subject,
      html: version.html,
      text: version.text
    }
  });

  await prisma.emailTemplateVersion.create({
    data: {
      templateKey: version.templateKey,
      subject: restored.subject,
      html: restored.html,
      text: restored.text,
      action: "ROLLBACK",
      createdByUserId: admin.id
    }
  });

  redirectWithToast("/admin/email-templates", "Email template restored.", "success");
}

export async function sendTestEmailAction(formData: FormData) {
  const csrf = validateCsrf();
  if (!csrf.ok) {
    redirectWithToast("/admin/email-templates", csrf.error ?? "CSRF validation failed.", "error");
    return;
  }
  await requireAdmin();

  const parsed = testSchema.safeParse({
    key: String(formData.get("key") || ""),
    email: String(formData.get("email") || "")
  });

  if (!parsed.success) {
    redirectWithToast("/admin/email-templates", "Invalid test email request.", "error");
    return;
  }

  const stored = await prisma.emailTemplate.findUnique({ where: { key: parsed.data.key } });
  const template = stored ?? getDefaultEmailTemplate(parsed.data.key as EmailTemplateKey);
  const context = buildSampleContext();
  const subject = applyTemplate(template.subject, context);
  const html = applyTemplate(template.html, context);
  const text = applyTemplate(template.text, context);

  await sendEmail({ to: parsed.data.email, subject, html, text });

  redirectWithToast("/admin/email-templates", "Test email sent.", "success");
}
