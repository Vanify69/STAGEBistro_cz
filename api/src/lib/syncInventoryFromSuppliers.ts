import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { inventoryItems, supplierItems } from '../db/schema.js';
import { getOstatniCategoryId } from './inventoryCategories.js';

function stockKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

/**
 * Pro každou položku dodavatele bez mapování založí surovinu (qty 0)
 * nebo znovu použije existující se stejným názvem+jednotkou a propojí FK.
 * Nové suroviny padají do kategorie Ostatní.
 */
export async function syncInventoryFromSupplierItems(): Promise<{
  created: number;
  linked: number;
  reused: number;
  skipped: number;
}> {
  const db = getDb();
  const ostatniId = await getOstatniCategoryId();
  const [catalog, existingStock] = await Promise.all([
    db.select().from(supplierItems).orderBy(asc(supplierItems.sortOrder), asc(supplierItems.name)),
    db.select().from(inventoryItems),
  ]);

  const byKey = new Map<string, (typeof existingStock)[0]>();
  for (const item of existingStock) {
    byKey.set(stockKey(item.name, item.unit), item);
  }

  let created = 0;
  let linked = 0;
  let reused = 0;
  let skipped = 0;

  for (const si of catalog) {
    if (si.inventoryItemId) {
      skipped += 1;
      continue;
    }

    const key = stockKey(si.name, si.unit);
    let inv = byKey.get(key);

    if (!inv) {
      const [row] = await db
        .insert(inventoryItems)
        .values({
          name: si.name.trim(),
          unit: si.unit.trim() || 'ks',
          qtyOnHand: '0',
          minQty: null,
          categoryId: ostatniId,
          active: si.active,
          sortOrder: si.sortOrder,
        })
        .returning();
      inv = row!;
      byKey.set(key, inv);
      created += 1;
    } else {
      reused += 1;
      if (!inv.categoryId && ostatniId) {
        await db
          .update(inventoryItems)
          .set({ categoryId: ostatniId, updatedAt: new Date() })
          .where(eq(inventoryItems.id, inv.id));
        inv = { ...inv, categoryId: ostatniId };
        byKey.set(key, inv);
      }
    }

    await db
      .update(supplierItems)
      .set({ inventoryItemId: inv.id })
      .where(eq(supplierItems.id, si.id));
    linked += 1;
  }

  return { created, linked, reused, skipped };
}
