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

function parseFromAddress(raw: string): { name?: string; email: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim();
    return { name: name || undefined, email: m[2].trim() };
  }
  return { email: trimmed };
}

/** Preferuj Brevo HTTP API — Railway často blokuje odchozí SMTP (587/465). */
export function isBrevoApiConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

export function isSmtpConfigured(): boolean {
  return (
    isBrevoApiConfigured() ||
    Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim())
  );
}

export function isMailConfigured(): boolean {
  return isSmtpConfigured() && Boolean(process.env.UCETNI_EMAIL?.trim());
}

async function sendViaBrevoApi(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY!.trim();
  const fromRaw =
    process.env.SMTP_FROM?.trim() ||
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    '';
  if (!fromRaw) {
    throw new Error(
      'BREVO_API_KEY je nastavené, ale chybí SMTP_FROM (nebo BREVO_SENDER_EMAIL) — ověřený odesílatel v Brevo.'
    );
  }
  const from = parseFromAddress(fromRaw);

  const payload: Record<string, unknown> = {
    sender: {
      email: from.email,
      ...(from.name ? { name: from.name } : {}),
    },
    to: [{ email: input.to }],
    subject: input.subject,
    textContent: input.text,
    ...(input.html ? { htmlContent: input.html } : {}),
  };

  if (input.attachments?.length) {
    payload.attachment = input.attachments.map((a) => ({
      name: a.filename,
      content: a.content.toString('base64'),
    }));
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let detail = bodyText.slice(0, 500);
    try {
      const parsed = JSON.parse(bodyText) as { message?: string; code?: string };
      detail = parsed.message || parsed.code || detail;
    } catch {
      /* keep raw */
    }
    throw new Error(`Brevo API selhalo (HTTP ${res.status}): ${detail}`);
  }
}

async function sendViaSmtp(input: SendMailInput): Promise<void> {
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
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    await transporter.verify();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `SMTP nepřijímá spojení (${host}:${port}). Na Railway často nefunguje — nastavte BREVO_API_KEY (HTTPS API). Detail: ${detail}`
    );
  }

  const from = process.env.SMTP_FROM?.trim() || user;

  try {
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Odeslání e-mailu přes SMTP selhalo: ${detail}`);
  }
}

export async function sendMail(input: SendMailInput): Promise<void> {
  if (isBrevoApiConfigured()) {
    await sendViaBrevoApi(input);
    return;
  }

  if (!process.env.SMTP_HOST?.trim() || !process.env.SMTP_USER?.trim()) {
    throw new Error(
      'E-mail není nakonfigurován. Na Railway nastavte BREVO_API_KEY (+ SMTP_FROM), SMTP porty bývají blokované.'
    );
  }

  await sendViaSmtp(input);
}
