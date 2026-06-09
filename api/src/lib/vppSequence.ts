import { sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';

export async function nextVppNumber(year: number): Promise<string> {
  const db = getDb();
  const result = await db.execute<{ last_number: number }>(sql`
    INSERT INTO document_sequence (kind, year, last_number)
    VALUES ('vpp', ${year}, 1)
    ON CONFLICT (kind, year)
    DO UPDATE SET last_number = document_sequence.last_number + 1
    RETURNING last_number
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: { last_number: number }[] }).rows ?? [];
  const num = Number((rows[0] as { last_number: number } | undefined)?.last_number ?? 1);
  return `VPP-${year}-${String(num).padStart(4, '0')}`;
}
