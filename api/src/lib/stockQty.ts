/** Quantity helpers for inventory (numeric stored as string). */

export function parseQty(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Skladové množství: celá čísla, max. 1 desetina (např. 12 nebo 12.5). */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function addQty(a: string | number, b: string | number): string {
  const na = typeof a === 'number' ? a : parseQty(a) ?? 0;
  const nb = typeof b === 'number' ? b : parseQty(b) ?? 0;
  return formatQty(na + nb);
}

export function sellablePortions(qtyOnHand: string, quantityPerPortion: string): number {
  const hand = parseQty(qtyOnHand) ?? 0;
  const per = parseQty(quantityPerPortion) ?? 0;
  if (per <= 0) return 0;
  return Math.floor(hand / per);
}
