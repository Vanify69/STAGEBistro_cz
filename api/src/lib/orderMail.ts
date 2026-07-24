import type { AuthUser } from './session.js';

export type OrderLineForTemplate = {
  nameSnapshot: string;
  unitSnapshot: string;
  quantity: string;
  lineNote?: string | null;
};

export function formatOrderLines(lines: OrderLineForTemplate[]): string {
  return lines
    .map((l) => {
      const base = `• ${l.nameSnapshot} — ${l.quantity} ${l.unitSnapshot}`;
      return l.lineNote?.trim() ? `${base} (${l.lineNote.trim()})` : base;
    })
    .join('\n');
}

export function renderOrderTemplate(
  template: string,
  vars: {
    datum: string;
    dodavatel: string;
    polozky: string;
    poznamka: string;
    odeslal: string;
  }
): string {
  return template
    .replaceAll('{{datum}}', vars.datum)
    .replaceAll('{{dodavatel}}', vars.dodavatel)
    .replaceAll('{{polozky}}', vars.polozky)
    .replaceAll('{{poznamka}}', vars.poznamka)
    .replaceAll('{{odeslal}}', vars.odeslal);
}

export function orderSenderLabel(user: AuthUser): string {
  return user.displayName?.trim() || user.email;
}

export function formatOrderDate(d = new Date()): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    dateStyle: 'medium',
  }).format(d);
}

export function noteBlock(note: string | null | undefined): string {
  const t = note?.trim();
  return t ? `Poznámka: ${t}` : '';
}
