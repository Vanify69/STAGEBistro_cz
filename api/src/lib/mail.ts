import nodemailer from 'nodemailer';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim());
}

export function isMailConfigured(): boolean {
  return isSmtpConfigured() && Boolean(process.env.UCETNI_EMAIL?.trim());
}

export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP není nakonfigurováno (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS ?? '';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: pass ? { user, pass } : undefined,
  });

  const from = process.env.SMTP_FROM?.trim() || user;

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
