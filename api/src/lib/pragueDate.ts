/** YYYY-MM-DD in Europe/Prague */
export function todayPragueYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function monthBounds(year: number, month: number): { start: string; end: string; daysInMonth: number } {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid month');
  }
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = `${y}-${m}-${daysInMonth.toString().padStart(2, '0')}`;
  return { start: `${y}-${m}-01`, end, daysInMonth };
}

export function yearMonthFromYmd(ymd: string): { year: number; month: number } {
  const [y, m] = ymd.split('-').map(Number);
  return { year: y!, month: m! };
}

/** Monday=0 … Sunday=6 for first day of month in Europe/Prague calendar grid */
export function weekdayIndexPrague(ymd: string): number {
  const [y, mo, d] = ymd.split('-').map(Number);
  const js = new Date(y!, mo! - 1, d!).getDay();
  return js === 0 ? 6 : js - 1;
}

export function paidAtPragueYearMonth(paidAt: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(paidAt);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
}
