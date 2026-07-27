/**
 * Storyous POS integration — prepared for later API access.
 * Do not call external Storyous endpoints from here yet.
 */
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { inventoryItems, menuRecipeLines, stockMovements } from '../../db/schema.js';
import { formatQty, parseQty, sellablePortions } from '../stockQty.js';

export type StoryousSaleLine = {
  /** Our menu_item.id once mapped via storyousProductId */
  menuItemId: string;
  portions: number;
};

/**
 * Deduct stock for sold menu portions using recipes.
 * Writes stock_movement kind=sale / source=pos.
 * TODO: wire from Storyous webhook/sync when API credentials are available.
 */
export async function applySaleDeduction(
  lines: StoryousSaleLine[],
  opts?: { refId?: string; createdBy?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (lines.length === 0) return { ok: true };
  const db = getDb();
  const menuIds = [...new Set(lines.map((l) => l.menuItemId))];
  const recipes = await db
    .select()
    .from(menuRecipeLines)
    .where(inArray(menuRecipeLines.menuItemId, menuIds));

  const byMenu = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const list = byMenu.get(r.menuItemId) ?? [];
    list.push(r);
    byMenu.set(r.menuItemId, list);
  }

  const deltas = new Map<string, number>();
  for (const line of lines) {
    if (line.portions <= 0) continue;
    const recipe = byMenu.get(line.menuItemId);
    if (!recipe || recipe.length === 0) {
      return { ok: false, error: `Menu item ${line.menuItemId} nemá recepturu` };
    }
    for (const r of recipe) {
      const per = parseQty(r.quantityPerPortion) ?? 0;
      const need = per * line.portions;
      deltas.set(r.inventoryItemId, (deltas.get(r.inventoryItemId) ?? 0) - need);
    }
  }

  for (const [inventoryItemId, delta] of deltas) {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, inventoryItemId))
      .limit(1);
    if (!item) return { ok: false, error: `Surovina ${inventoryItemId} nenalezena` };
    const next = (parseQty(item.qtyOnHand) ?? 0) + delta;
    await db
      .update(inventoryItems)
      .set({ qtyOnHand: formatQty(next), updatedAt: new Date() })
      .where(eq(inventoryItems.id, inventoryItemId));
    await db.insert(stockMovements).values({
      inventoryItemId,
      kind: 'sale',
      quantityDelta: formatQty(delta),
      source: 'pos',
      refType: 'storyous_sale',
      refId: opts?.refId ?? null,
      note: null,
      createdBy: opts?.createdBy ?? null,
    });
  }

  return { ok: true };
}

export function computeSellableFromRecipe(
  recipe: { inventoryItemId: string; quantityPerPortion: string }[],
  stockById: Map<string, string>
): number | null {
  if (recipe.length === 0) return null;
  let min: number | null = null;
  for (const r of recipe) {
    const hand = stockById.get(r.inventoryItemId) ?? '0';
    const n = sellablePortions(hand, r.quantityPerPortion);
    min = min == null ? n : Math.min(min, n);
  }
  return min ?? 0;
}
