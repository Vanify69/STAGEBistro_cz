import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { inventoryCategories } from '../db/schema.js';

export const DEFAULT_INVENTORY_CATEGORIES: { name: string; sortOrder: number }[] = [
  { name: 'Maso / protein', sortOrder: 10 },
  { name: 'Pečivo / tortilly', sortOrder: 20 },
  { name: 'Zelenina / saláty', sortOrder: 30 },
  { name: 'Omáčky / dressingy', sortOrder: 40 },
  { name: 'Sýry / mléčné', sortOrder: 50 },
  { name: 'Nápoje', sortOrder: 60 },
  { name: 'Balení / spotřební', sortOrder: 70 },
  { name: 'Ostatní', sortOrder: 100 },
];

export async function ensureDefaultInventoryCategories(): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(inventoryCategories).limit(1);
  if (existing.length > 0) return;
  await db.insert(inventoryCategories).values(
    DEFAULT_INVENTORY_CATEGORIES.map((c) => ({
      name: c.name,
      sortOrder: c.sortOrder,
      active: true,
    }))
  );
}

export async function getOstatniCategoryId(): Promise<string | null> {
  await ensureDefaultInventoryCategories();
  const db = getDb();
  const rows = await db
    .select()
    .from(inventoryCategories)
    .where(eq(inventoryCategories.name, 'Ostatní'))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const [fallback] = await db
    .select()
    .from(inventoryCategories)
    .orderBy(asc(inventoryCategories.sortOrder))
    .limit(1);
  return fallback?.id ?? null;
}
