export function computeWorkedMinutes(actualStart: Date, actualEnd: Date, breakMinutes = 0): number {
  const diffMs = actualEnd.getTime() - actualStart.getTime();
  if (diffMs <= 0) {
    throw new Error('Konec směny musí být po začátku');
  }
  const minutes = Math.round(diffMs / 60_000) - breakMinutes;
  if (minutes <= 0) {
    throw new Error('Odpracovaný čas musí být kladný');
  }
  return minutes;
}

export function minutesToAmountCents(workedMinutes: number, hourlyRateCents: number): number {
  return Math.round((workedMinutes / 60) * hourlyRateCents);
}

/** HH:MM or HH:MM:SS from Postgres time */
export function formatTimeHm(t: string): string {
  return t.slice(0, 5);
}

export function parseHmOnDate(ymd: string, hm: string): Date {
  const [h, m] = hm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error('Neplatný čas');
  }
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const d = parts[2]!;
  return new Date(y, mo - 1, d, h, m, 0, 0);
}
