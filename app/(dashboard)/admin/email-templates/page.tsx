import { requireAdmin } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { formatDateTime24 } from "@/app/lib/utils";
import { checkMailerStatus } from "@/app/lib/email/mailer";
import { applyTemplate, emailTemplateDefinitions } from "@/app/lib/auth/email-templates";
import {
  rollbackEmailTemplateAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendTestEmailAction
} from "@/app/lib/actions/email-template-actions";

const sampleName = "Avery Pilot";
const sampleEmail = "avery@example.com";
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.flighttraks.com";

const sampleContext = {
  name: sampleName,
  email: sampleEmail,
  appUrl: baseUrl,
  logoUrl: `${baseUrl}/brand/flighttraks-logo.svg`,
  supportEmail: "support@flighttraks.com",
  approverEmail: "admin@flighttraks.com",
  applicantName: sampleName,
  applicantEmail: sampleEmail,
  applicantPhone: "+1 (555) 555-5555",
  approveUrl: `${baseUrl}/api/admin/approve?token=sample`,
  rejectUrl: `${baseUrl}/api/admin/reject?token=sample`,
  verifyUrl: `${baseUrl}/verify-email?token=sample`,
  loginUrl: `${baseUrl}/login`,
  dashboardUrl: `${baseUrl}/dashboard`,
  supportUrl: `${baseUrl}/login`,
  resetUrl: `${baseUrl}/reset-password?token=sample`
};

function TemplateCard({
  title,
  description,
  subject,
  html,
  text,
  placeholders,
  templateKey,
  versions
}: {
  title: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  placeholders: string[];
  templateKey: string;
  versions: {
    id: string;
    action: string;
    createdAt: Date;
    createdByUser?: { name: string | null; email: string } | null;
  }[];
}) {
  const previewSubject = applyTemplate(subject, sampleContext);
  const previewHtml = applyTemplate(html, sampleContext);
  const previewText = applyTemplate(text, sampleContext);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-base font-semibold text-slate-100">Subject: {previewSubject}</p>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {placeholders.map((placeholder) => (
              <span
                key={placeholder}
                className="rounded-full border border-slate-800 bg-slate-950/40 px-2 py-1"
              >
                {"{{"}
                {placeholder}
                {"}}"}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <form action={saveEmailTemplateAction} className="space-y-4">
            <input type="hidden" name="key" value={templateKey} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Subject</label>
              <Input name="subject" defaultValue={subject} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">HTML</label>
              <textarea
                name="html"
                defaultValue={html}
                rows={12}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Plain text</label>
              <textarea
                name="text"
                defaultValue={text}
                rows={10}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              />
            </div>
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save template
            </FormSubmitButton>
          </form>
          <div className="flex flex-wrap gap-2">
            <form action={resetEmailTemplateAction}>
              <input type="hidden" name="key" value={templateKey} />
              <Button type="submit" variant="ghost">
                Reset to default
              </Button>
            </form>
            <form action={sendTestEmailAction} className="flex flex-1 flex-wrap gap-2">
              <input type="hidden" name="key" value={templateKey} />
              <Input
                name="email"
                type="email"
                placeholder="Send test to..."
                className="min-w-[220px]"
              />
              <FormSubmitButton type="submit" pendingText="Sending...">
                Send test
              </FormSubmitButton>
            </form>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase text-slate-500">HTML preview</p>
            <div className="prose prose-invert mt-3 max-w-none text-sm">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase text-slate-500">Plain text</p>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{previewText}</pre>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase text-slate-500">Version history</p>
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No edits yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {versions.map((version) => {
                  const author =
                    version.createdByUser?.name ||
                    version.createdByUser?.email ||
                    "System";
                  return (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300"
                    >
                      <div className="space-x-2">
                        <span className="font-semibold text-slate-100">{version.action}</span>
                        <span>{formatDateTime24(new Date(version.createdAt))}</span>
                        <span>· {author}</span>
                      </div>
                      <form action={rollbackEmailTemplateAction}>
                        <input type="hidden" name="versionId" value={version.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Restore
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminEmailTemplatesPage() {
  await requireAdmin();

  const mailerStatus = await checkMailerStatus();
  const storedTemplates = await prisma.emailTemplate.findMany();
  const templateKeys = emailTemplateDefinitions.map((template) => template.key);
  const storedVersions = await prisma.emailTemplateVersion.findMany({
    where: { templateKey: { in: templateKeys } },
    include: { createdByUser: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  const templatesByKey = new Map(storedTemplates.map((template) => [template.key, template]));
  const versionsByKey = new Map<string, typeof storedVersions>();
  for (const version of storedVersions) {
    if (!versionsByKey.has(version.templateKey)) {
      versionsByKey.set(version.templateKey, []);
    }
    const versions = versionsByKey.get(version.templateKey) ?? [];
    if (versions.length < 5) {
      versions.push(version);
      versionsByKey.set(version.templateKey, versions);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Email templates</h2>
        <p className="text-sm text-slate-400">
          Update the HTML and text sent during the account lifecycle. Use the placeholder
          chips to insert dynamic values.
        </p>
        {!mailerStatus.ok ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            Mailer warning: {mailerStatus.error ?? "Mailer verification failed."} Emails will not send
            until SMTP credentials are fixed.
          </div>
        ) : null}
      </div>

      {emailTemplateDefinitions.map((template) => {
        const stored = templatesByKey.get(template.key);
        return (
          <TemplateCard
            key={template.key}
            title={template.title}
            description={template.description}
            subject={stored?.subject ?? template.subject}
            html={stored?.html ?? template.html}
            text={stored?.text ?? template.text}
            placeholders={template.placeholders}
            templateKey={template.key}
            versions={versionsByKey.get(template.key) ?? []}
          />
        );
      })}
    </div>
  );
}

