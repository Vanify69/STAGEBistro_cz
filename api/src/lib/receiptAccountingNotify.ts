import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { expenseReceipts } from '../db/schema.js';
import { isMailConfigured, sendMail } from './mail.js';
import { getObjectBuffer } from './s3.js';

type ReceiptRow = typeof expenseReceipts.$inferSelect;

const CATEGORY_LABELS: Record<ReceiptRow['category'], string> = {
  nafta: 'Nafta',
  suroviny: 'Suroviny',
  ostatni: 'Ostatní',
};

function publicWebUrl(): string {
  const keys = ['APP_PUBLIC_URL', 'CORS_ORIGIN', 'FRONTEND_ORIGIN', 'WEB_ORIGIN'] as const;
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v.replace(/\/$/, '').split(',')[0]!.trim().replace(/\/$/, '');
  }
  return 'http://localhost:5173';
}

function formatAmount(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2).replace('.', ',')} Kč`;
}

function filenameForReceipt(receipt: ReceiptRow): string {
  const ext =
    receipt.mime === 'application/pdf'
      ? 'pdf'
      : receipt.mime?.includes('png')
        ? 'png'
        : receipt.mime?.includes('webp')
          ? 'webp'
          : 'jpg';
  return `doklad-${receipt.id.slice(0, 8)}.${ext}`;
}

export async function notifyAccountingOfReceipt(receipt: ReceiptRow): Promise<{
  emailed: boolean;
  skippedReason?: string;
}> {
  if (!receipt.storageKey) {
    return { emailed: false, skippedReason: 'no_storage' };
  }

  if (receipt.accountingEmailedAt) {
    return { emailed: false, skippedReason: 'already_emailed' };
  }

  if (!isMailConfigured()) {
    console.warn(
      '[receipt-accounting] Doklad nahrán, ale e-mail není nakonfigurován (UCETNI_EMAIL + SMTP). Fronta v portálu účetní.'
    );
    return { emailed: false, skippedReason: 'mail_not_configured' };
  }

  const to = process.env.UCETNI_EMAIL!.trim();
  const categoryLabel = CATEGORY_LABELS[receipt.category] ?? receipt.category;
  const portalUrl = `${publicWebUrl()}/ucetni`;

  let attachmentContent: Buffer;
  try {
    const bytes = await getObjectBuffer(receipt.storageKey);
    attachmentContent = Buffer.from(bytes);
  } catch (err) {
    console.error('[receipt-accounting] Stažení souboru z R2 selhalo:', err);
    return { emailed: false, skippedReason: 'storage_read_failed' };
  }

  const text = [
    'Dobrý den,',
    '',
    'byl nahrán nový doklad do Stage Bistro.',
    '',
    `Kategorie: ${categoryLabel}`,
    `Částka: ${formatAmount(receipt.amountCents)}`,
    receipt.businessDate ? `Datum: ${receipt.businessDate}` : null,
    receipt.note ? `Poznámka: ${receipt.note}` : null,
    '',
    `Doklad najdete v portálu účetní: ${portalUrl}`,
    '',
    'Stage Bistro — automatická zpráva',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await sendMail({
      to,
      subject: `Nový doklad — ${categoryLabel} — Stage Bistro`,
      text,
      html: text.replace(/\n/g, '<br>\n'),
      attachments: [
        {
          filename: filenameForReceipt(receipt),
          content: attachmentContent,
          contentType: receipt.mime || 'application/octet-stream',
        },
      ],
    });
  } catch (err) {
    console.error('[receipt-accounting] Odeslání e-mailu selhalo:', err);
    return { emailed: false, skippedReason: 'send_failed' };
  }

  const db = getDb();
  await db
    .update(expenseReceipts)
    .set({ accountingEmailedAt: new Date() })
    .where(eq(expenseReceipts.id, receipt.id));

  console.log(`[receipt-accounting] E-mail odeslán účetní (${to}) — ${receipt.id}`);
  return { emailed: true };
}
