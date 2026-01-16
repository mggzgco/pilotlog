export const EMAIL_TEMPLATE_KEYS = {
  APPROVAL_REQUEST: "APPROVAL_REQUEST",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED",
  WELCOME: "WELCOME",
  ACCOUNT_REJECTED: "ACCOUNT_REJECTED",
  PASSWORD_RESET: "PASSWORD_RESET"
} as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS];

export type EmailTemplateContent = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplateDefinition = EmailTemplateContent & {
  key: EmailTemplateKey;
  title: string;
  description: string;
  placeholders: string[];
};

const brandName = "FlightTraks";

const featureBlocksHtml = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
    <tr>
      <td style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
        <div style="font-weight:600;color:#0f172a;">Live flight insights</div>
        <div style="font-size:13px;color:#475569;margin-top:6px;">
          Capture logbook totals, ADS-B tracks, and costs in one streamlined view.
        </div>
      </td>
    </tr>
    <tr>
      <td height="10"></td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
        <div style="font-weight:600;color:#0f172a;">Operations-ready reporting</div>
        <div style="font-size:13px;color:#475569;margin-top:6px;">
          Export-ready reports, currency tracking, and instructor-ready summaries.
        </div>
      </td>
    </tr>
    <tr>
      <td height="10"></td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
        <div style="font-weight:600;color:#0f172a;">Receipts &amp; cost control</div>
        <div style="font-size:13px;color:#475569;margin-top:6px;">
          Track expenses, store receipts, and keep flight spending organized.
        </div>
      </td>
    </tr>
  </table>
`;

const testimonialHtml = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
    <tr>
      <td style="padding:16px;border-left:4px solid #0f172a;background:#f1f5f9;border-radius:12px;">
        <div style="font-size:14px;color:#0f172a;font-style:italic;">
          “FlightTraks feels like having a dispatch desk in my pocket. My logbook, costs, and checklists
          are finally in one place.”
        </div>
        <div style="margin-top:10px;font-size:12px;color:#475569;">— Professional pilot &amp; instructor</div>
      </td>
    </tr>
  </table>
`;

const secondaryCtaHtml = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 4px;">
    <tr>
      <td style="padding:12px 16px;border:1px dashed #cbd5f5;border-radius:12px;background:#eef2ff;color:#1e293b;font-size:13px;">
        Explore the full platform at <a href="{{appUrl}}" style="color:#1e293b;font-weight:600;">{{appUrl}}</a>
      </td>
    </tr>
  </table>
`;

function wrapEmailLayout({
  preheader,
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerHtml
}: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerHtml?: string;
}) {
  const cta = ctaLabel && ctaUrl
    ? `
      <tr>
        <td align="center" style="padding: 8px 24px 0;">
          <a href="${ctaUrl}" style="background:#0f172a;border-radius:10px;color:#ffffff;display:inline-block;font-size:15px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;width:220px;">
            ${ctaLabel}
          </a>
        </td>
      </tr>
    `
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      ${preheader}
    </span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;box-shadow:0 12px 30px rgba(15,23,42,0.12);overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.6px;">
                      <img src="{{logoUrl}}" alt="${brandName}" height="32" style="display:block;border:0;outline:none;text-decoration:none;height:32px;max-width:180px;" />
                      <div style="font-size:14px;letter-spacing:0.4px;margin-top:8px;">${brandName}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#cbd5f5;font-size:13px;padding-top:6px;">
                      Flight operations, logbook, and insights in one cockpit view
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${heading}</h1>
                <div style="font-size:15px;line-height:1.6;color:#1e293b;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:28px 32px;color:#64748b;font-size:12px;line-height:1.6;">
                ${footerHtml ?? `You received this email because you requested access to ${brandName}.`}
                <div style="padding-top:8px;">
                  ${brandName} · <a href="{{appUrl}}" style="color:#64748b;">{{appUrl}}</a>
                  <span style="padding:0 6px;">·</span>
                  <a href="mailto:{{supportEmail}}" style="color:#64748b;">{{supportEmail}}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export const emailTemplateDefinitions: EmailTemplateDefinition[] = [
  {
    key: EMAIL_TEMPLATE_KEYS.APPROVAL_REQUEST,
    title: "Access request (admin approval)",
    description: "Sent to admins when a new pilot requests access.",
    placeholders: [
      "approverEmail",
      "applicantName",
      "applicantEmail",
      "applicantPhone",
      "approveUrl",
      "rejectUrl",
      "appUrl",
      "logoUrl",
      "supportEmail"
    ],
    subject: "Approval needed: {{applicantEmail}}",
    text: [
      "A new pilot account is awaiting approval.",
      "",
      "Name: {{applicantName}}",
      "Email: {{applicantEmail}}",
      "Phone: {{applicantPhone}}",
      "",
      "Approve: {{approveUrl}}",
      "Reject: {{rejectUrl}}",
      "",
      "FlightTraks Admin"
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "A new FlightTraks account is awaiting approval.",
      heading: "Pilot access request",
      bodyHtml: `
        <p>Hi there,</p>
        <p>A new pilot just requested access to ${brandName}. Here are the details:</p>
        <ul style="padding-left:18px;margin:16px 0 18px;">
          <li><strong>Name:</strong> {{applicantName}}</li>
          <li><strong>Email:</strong> {{applicantEmail}}</li>
          <li><strong>Phone:</strong> {{applicantPhone}}</li>
        </ul>
        <p>Use the buttons below to approve or reject the request.</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Approve request",
      ctaUrl: "{{approveUrl}}",
      footerHtml: `
        <div>Reject instead: <a href="{{rejectUrl}}" style="color:#0f172a;font-weight:600;">Decline request</a></div>
      `
    })
  },
  {
    key: EMAIL_TEMPLATE_KEYS.VERIFY_EMAIL,
    title: "Verify email",
    description: "Sent to users to confirm their email address.",
    placeholders: ["name", "email", "verifyUrl", "appUrl", "logoUrl", "supportEmail"],
    subject: `Verify your ${brandName} email`,
    text: [
      "Hi {{name}},",
      "",
      "Thanks for requesting access to FlightTraks.",
      "Please confirm your email address to continue your registration.",
      "",
      "{{verifyUrl}}",
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "Confirm your email to activate your FlightTraks account.",
      heading: "Confirm your email",
      bodyHtml: `
        <p>Hi {{name}},</p>
        <p>Thanks for requesting access to ${brandName}. Please confirm your email address to continue your registration.</p>
        <p>This verification link is valid for 24 hours.</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Verify email",
      ctaUrl: "{{verifyUrl}}",
      footerHtml: "If you did not request access to FlightTraks, you can safely ignore this email."
    })
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED,
    title: "Account approved",
    description: "Sent when the admin approves a user.",
    placeholders: ["name", "email", "loginUrl", "appUrl", "logoUrl", "supportEmail"],
    subject: "You're approved — welcome aboard",
    text: [
      "Hi {{name}},",
      "",
      "Great news — your FlightTraks account has been approved.",
      "You can now sign in and start logging your flights.",
      "",
      "{{loginUrl}}"
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "Your FlightTraks account is now active.",
      heading: "You're approved",
      bodyHtml: `
        <p>Hi {{name}},</p>
        <p>Great news — your ${brandName} account has been approved. You're cleared to start tracking flights, costs, and logbook totals.</p>
        <p>Ready for takeoff?</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Sign in",
      ctaUrl: "{{loginUrl}}",
      footerHtml: "Questions? Reply to this email and our team will help."
    })
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WELCOME,
    title: "Welcome email",
    description: "Sent immediately after approval.",
    placeholders: ["name", "email", "dashboardUrl", "appUrl", "logoUrl", "supportEmail"],
    subject: `Welcome to ${brandName}`,
    text: [
      "Welcome {{name}}!",
      "",
      "We're excited to have you in FlightTraks.",
      "Open your dashboard to start your first entry.",
      "",
      "{{dashboardUrl}}"
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "Start your first FlightTraks entry today.",
      heading: "Welcome to FlightTraks",
      bodyHtml: `
        <p>Welcome {{name}}!</p>
        <p>We're excited to have you in ${brandName}. Your dashboard is ready with insights, charts, and logbook tools.</p>
        <p>Start by adding your first flight or importing ADS-B data.</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Open dashboard",
      ctaUrl: "{{dashboardUrl}}"
    })
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED,
    title: "Account rejected",
    description: "Sent if an admin rejects an account request.",
    placeholders: ["name", "email", "supportUrl", "appUrl", "logoUrl", "supportEmail"],
    subject: "Update on your FlightTraks request",
    text: [
      "Hi {{name}},",
      "",
      "We reviewed your request to access FlightTraks.",
      "At this time, the request was not approved.",
      "",
      "If you believe this is a mistake, contact support: {{supportUrl}}"
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "An update on your FlightTraks access request.",
      heading: "Access request update",
      bodyHtml: `
        <p>Hi {{name}},</p>
        <p>We reviewed your request to access ${brandName}. At this time, the request was not approved.</p>
        <p>If you believe this is a mistake, please reach out to support.</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Contact support",
      ctaUrl: "{{supportUrl}}"
    })
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    title: "Password reset",
    description: "Sent when a user requests a password reset.",
    placeholders: ["name", "email", "resetUrl", "appUrl", "logoUrl", "supportEmail"],
    subject: "Reset your FlightTraks password",
    text: [
      "Hi {{name}},",
      "",
      "We received a request to reset your FlightTraks password.",
      "Use the link below to set a new password. This link expires in 60 minutes.",
      "",
      "{{resetUrl}}",
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: wrapEmailLayout({
      preheader: "Reset your FlightTraks password in one click.",
      heading: "Reset your password",
      bodyHtml: `
        <p>Hi {{name}},</p>
        <p>We received a request to reset your ${brandName} password.</p>
        <p>This link will expire in 60 minutes.</p>
        ${featureBlocksHtml}
        ${testimonialHtml}
        ${secondaryCtaHtml}
      `,
      ctaLabel: "Reset password",
      ctaUrl: "{{resetUrl}}",
      footerHtml: "If you did not request a password reset, you can safely ignore this message."
    })
  }
];

export const emailTemplateOrder = emailTemplateDefinitions.map((template) => template.key);

export function getDefaultEmailTemplate(key: EmailTemplateKey): EmailTemplateContent {
  const template = emailTemplateDefinitions.find((entry) => entry.key === key);
  if (!template) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  return {
    subject: template.subject,
    html: template.html,
    text: template.text
  };
}

export function getEmailTemplateDefinition(key: EmailTemplateKey): EmailTemplateDefinition {
  const template = emailTemplateDefinitions.find((entry) => entry.key === key);
  if (!template) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  return template;
}

export function applyTemplate(input: string, context: Record<string, string | number | null | undefined>) {
  return input.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
    const value = context[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}
