import { PDFDocument } from 'pdf-lib';
import { getStorageBuffer } from '../storage.js';
import { embedPdfFonts } from './pdfFonts.js';
import { drawWrappedParagraph } from './pdfWrap.js';

export type VppPdfInput = {
  vppNumber: string;
  paidAt: Date;
  recipientName: string;
  amountCents: number;
  reason: string;
  recipientSignatureKey?: string | null;
  issuerSignatureKey?: string | null;
};

function formatKc(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} Kč`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d);
}

export async function buildVppPdf(input: VppPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { regular: font, bold } = await embedPdfFonts(doc);
  const page = doc.addPage([420, 595]);
  const x = 40;
  const contentWidth = 340;
  let y = 540;

  const row = (label: string, value: string) => {
    page.drawText(label, { x, y, size: 11, font: bold });
    y = drawWrappedParagraph(page, value, 160, y, font, 11, contentWidth - 120);
    y -= 8;
  };

  page.drawText('VÝDAJOVÝ POKLADNÍ DOKLAD', { x, y, size: 13, font: bold });
  y -= 32;
  row('Číslo dokladu:', input.vppNumber);
  row('Datum:', formatDate(input.paidAt));
  row('Vyplaceno komu:', input.recipientName);
  row('Částka:', formatKc(input.amountCents));
  row('Důvod:', input.reason);
  y -= 8;
  page.drawText('Podpis příjemce:', { x, y, size: 10, font: bold });
  y -= 70;
  if (input.recipientSignatureKey) {
    try {
      const png = await getStorageBuffer(input.recipientSignatureKey);
      if (png) {
        const img = await doc.embedPng(png);
        page.drawImage(img, { x, y: y + 10, width: 140, height: 50 });
      }
    } catch {
      page.drawLine({ start: { x, y: y + 50 }, end: { x: x + 160, y: y + 50 }, thickness: 0.5 });
    }
  } else {
    page.drawLine({ start: { x, y: y + 50 }, end: { x: x + 160, y: y + 50 }, thickness: 0.5 });
  }
  y -= 24;
  page.drawText('Podpis vydal:', { x, y, size: 10, font: bold });
  y -= 70;
  if (input.issuerSignatureKey) {
    try {
      const png = await getStorageBuffer(input.issuerSignatureKey);
      if (png) {
        const img = await doc.embedPng(png);
        page.drawImage(img, { x, y: y + 10, width: 140, height: 50 });
      }
    } catch {
      page.drawLine({ start: { x, y: y + 50 }, end: { x: x + 160, y: y + 50 }, thickness: 0.5 });
    }
  } else {
    page.drawLine({ start: { x, y: y + 50 }, end: { x: x + 160, y: y + 50 }, thickness: 0.5 });
  }

  return doc.save();
}
