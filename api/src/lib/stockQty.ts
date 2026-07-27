/** Quantity helpers for inventory (numeric stored as string). */

export function parseQty(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1_000_000) / 1_000_000;
  return String(rounded);
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
