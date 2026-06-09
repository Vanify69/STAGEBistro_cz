import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { workers } from '../db/schema.js';
import { isMailConfigured, sendMail } from './mail.js';

type WorkerRow = typeof workers.$inferSelect;

export function isContractReadyForAccounting(worker: WorkerRow): boolean {
  return (
    worker.status === 'active' &&
    !worker.deletedAt &&
    Boolean(worker.contractPdfKey) &&
    Boolean(worker.contractSignedAt)
  );
}

function publicWebUrl(): string {
  const keys = ['APP_PUBLIC_URL', 'CORS_ORIGIN', 'FRONTEND_ORIGIN', 'WEB_ORIGIN'] as const;
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v.replace(/\/$/, '');
  }
  return 'http://localhost:5173';
}

function formatSignedAt(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export async function notifyAccountingOfContract(worker: WorkerRow): Promise<{
  emailed: boolean;
  skippedReason?: string;
}> {
  if (!isContractReadyForAccounting(worker)) {
    return { emailed: false, skippedReason: 'contract_not_ready' };
  }

  if (worker.contractAccountingEmailedAt) {
    return { emailed: false, skippedReason: 'already_emailed' };
  }

  if (!isMailConfigured()) {
    console.warn(
      '[contract-accounting] Smlouva připravena, ale e-mail není nakonfigurován (UCETNI_EMAIL + SMTP). Fronta v portálu účetní.'
    );
    return { emailed: false, skippedReason: 'mail_not_configured' };
  }

  const to = process.env.UCETNI_EMAIL!.trim();
  const name = `${worker.firstName} ${worker.lastName}`;
  const signedLabel = worker.contractSignedAt ? formatSignedAt(worker.contractSignedAt) : '—';
  const sourceLabel = worker.contractSource === 'scan' ? 'nahrán sken' : 'digitální podpis';
  const portalUrl = `${publicWebUrl()}/ucetni`;

  const text = [
    'Dobrý den,',
    '',
    `byla aktivována nová smlouva DPC: ${name} (${worker.position}).`,
    `Typ: ${sourceLabel}`,
    `Datum aktivace: ${signedLabel}`,
    worker.contractStart ? `Smlouva od: ${worker.contractStart}` : null,
    `Hodinová mzda: ${(worker.hourlyRateCents / 100).toFixed(0)} Kč/h`,
    '',
    `Smlouvu najdete v portálu účetní: ${portalUrl}`,
    '(záložka Smlouvy DPC)',
    '',
    'Stage Bistro — automatická zpráva',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await sendMail({
      to,
      subject: `Nová smlouva DPC — ${name}`,
      text,
      html: text.replace(/\n/g, '<br>\n'),
    });
  } catch (err) {
    console.error('[contract-accounting] Odeslání e-mailu selhalo:', err);
    return { emailed: false, skippedReason: 'send_failed' };
  }

  const db = getDb();
  await db
    .update(workers)
    .set({ contractAccountingEmailedAt: new Date(), updatedAt: new Date() })
    .where(eq(workers.id, worker.id));

  console.log(`[contract-accounting] E-mail odeslán účetní (${to}) — ${name}`);
  return { emailed: true };
}
