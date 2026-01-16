import { mailer, verifyMailer } from "@/app/lib/email/mailer";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function getFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "FlightTraks <no-reply@flighttraks.com>"
  );
}

export function getReplyToAddress() {
  return (
    process.env.EMAIL_REPLY_TO ||
    process.env.SUPPORT_EMAIL ||
    "support@flighttraks.com"
  );
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  await verifyMailer();
  return mailer.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text,
    replyTo: getReplyToAddress()
  });
}
