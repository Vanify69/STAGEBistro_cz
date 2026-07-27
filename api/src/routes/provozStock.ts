import { Hono } from 'hono';
import { z } from 'zod';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  inventoryItems,
  menuCategories,
  menuItems,
  menuRecipeLines,
  stockMovements,
} from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { permProvozStock, permInventoryRead } from '../lib/staffRoutePermissions.js';
import { auditAction, AUDIT_ACTIONS } from '../lib/auditLog.js';
import { formatQty, parseQty } from '../lib/stockQty.js';
import { computeSellableFromRecipe } from '../lib/storyous/applySaleDeduction.js';
import { syncInventoryFromSupplierItems } from '../lib/syncInventoryFromSuppliers.js';

export const provozStockRouter = new Hono<{ Variables: { user: AuthUser } }>();

provozStockRouter.use('*', requireAuth);

const inventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  qtyOnHand: z.string().max(40).optional(),
  minQty: z.string().max(40).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const inventoryCountSchema = z.object({
  note: z.string().max(2000).nullable().optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        countedQty: z.string().min(1).max(40),
      })
    )
    .min(1),
});

provozStockRouter.post('/inventory-items/sync-from-suppliers', permProvozStock, async (c) => {
  const result = await syncInventoryFromSupplierItems();
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.inventorySyncSuppliers,
    entityType: 'inventory_item',
    entityId: null,
    summary: `Sync skladu z dodavatelů: +${result.created} surovin, ${result.linked} propojeno`,
    metadata: result,
  });
  return c.json(result);
});

provozStockRouter.get('/inventory-items', permInventoryRead, async (c) => {
  const db = getDb();
  const includeInactive = c.req.query('all') === '1';
  const rows = includeInactive
    ? await db
        .select()
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.name))
    : await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.active, true))
        .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.name));
  return c.json({
    items: rows.map((row) => ({
      ...row,
      qtyOnHand: formatQty(parseQty(row.qtyOnHand) ?? 0),
      minQty: row.minQty == null ? null : formatQty(parseQty(row.minQty) ?? 0),
    })),
  });
});

provozStockRouter.post('/inventory-items', permProvozStock, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = inventoryItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const qty = parsed.data.qtyOnHand != null ? parseQty(parsed.data.qtyOnHand) : 0;
  if (qty == null) return c.json({ error: 'Neplatné množství' }, 400);
  const minQty =
    parsed.data.minQty === undefined || parsed.data.minQty === null
      ? null
      : parseQty(parsed.data.minQty);
  if (parsed.data.minQty != null && minQty == null) {
    return c.json({ error: 'Neplatné min. množství' }, 400);
  }
  const db = getDb();
  const [row] = await db
    .insert(inventoryItems)
    .values({
      name: parsed.data.name.trim(),
      unit: parsed.data.unit.trim(),
      qtyOnHand: formatQty(qty),
      minQty: minQty == null ? null : formatQty(minQty),
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.inventoryItemCreate,
    entityType: 'inventory_item',
    entityId: row!.id,
    summary: `Nová surovina ${row!.name}`,
  });
  return c.json({ item: row }, 201);
});

provozStockRouter.patch('/inventory-items/:id', permProvozStock, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = inventoryItemSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const patch: Partial<typeof inventoryItems.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name != null) patch.name = parsed.data.name.trim();
  if (parsed.data.unit != null) patch.unit = parsed.data.unit.trim();
  if (parsed.data.qtyOnHand != null) {
    const qty = parseQty(parsed.data.qtyOnHand);
    if (qty == null) return c.json({ error: 'Neplatné množství' }, 400);
    patch.qtyOnHand = formatQty(qty);
  }
  if (parsed.data.minQty !== undefined) {
    if (parsed.data.minQty === null || parsed.data.minQty.trim() === '') {
      patch.minQty = null;
    } else {
      const minQty = parseQty(parsed.data.minQty);
      if (minQty == null) return c.json({ error: 'Neplatné min. množství' }, 400);
      patch.minQty = formatQty(minQty);
    }
  }
  if (parsed.data.active != null) patch.active = parsed.data.active;
  if (parsed.data.sortOrder != null) patch.sortOrder = parsed.data.sortOrder;
  const [row] = await db.update(inventoryItems).set(patch).where(eq(inventoryItems.id, id)).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.inventoryItemUpdate,
    entityType: 'inventory_item',
    entityId: id,
    summary: `Upravena surovina ${row.name}`,
  });
  return c.json({ item: row });
});

provozStockRouter.get('/stock-movements', permProvozStock, async (c) => {
  const db = getDb();
  const limit = Math.min(Number(c.req.query('limit') ?? '50') || 50, 200);
  const itemId = c.req.query('inventoryItemId');
  const rows = itemId
    ? await db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.inventoryItemId, itemId))
        .orderBy(desc(stockMovements.createdAt))
        .limit(limit)
    : await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(limit);
  return c.json({ movements: rows });
});

provozStockRouter.post('/inventory-counts', permProvozStock, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = inventoryCountSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const user = c.get('user');
  const db = getDb();
  const ids = parsed.data.lines.map((l) => l.inventoryItemId);
  const items = await db.select().from(inventoryItems).where(inArray(inventoryItems.id, ids));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const adjustments: {
    inventoryItemId: string;
    expected: string;
    counted: string;
    delta: string;
  }[] = [];

  for (const line of parsed.data.lines) {
    const item = itemMap.get(line.inventoryItemId);
    if (!item) return c.json({ error: `Surovina ${line.inventoryItemId} nenalezena` }, 404);
    const counted = parseQty(line.countedQty);
    if (counted == null) return c.json({ error: `Neplatné množství u ${item.name}` }, 400);
    const expected = parseQty(item.qtyOnHand) ?? 0;
    const delta = counted - expected;
    if (delta === 0) continue;
    const countedStr = formatQty(counted);
    const deltaStr = formatQty(delta);
    await db
      .update(inventoryItems)
      .set({ qtyOnHand: countedStr, updatedAt: new Date() })
      .where(eq(inventoryItems.id, item.id));
    await db.insert(stockMovements).values({
      inventoryItemId: item.id,
      kind: 'inventory_adjust',
      quantityDelta: deltaStr,
      source: 'inventory',
      refType: 'inventory_count',
      refId: null,
      note: parsed.data.note?.trim() || null,
      createdBy: user.id,
    });
    adjustments.push({
      inventoryItemId: item.id,
      expected: formatQty(expected),
      counted: countedStr,
      delta: deltaStr,
    });
  }

  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.inventoryCount,
    entityType: 'inventory_count',
    entityId: null,
    summary: `Inventura: ${adjustments.length} úprav`,
    metadata: { note: parsed.data.note ?? null, adjustments },
  });

  return c.json({ ok: true, adjustments });
});

provozStockRouter.get('/menu-availability', permProvozStock, async (c) => {
  const db = getDb();
  const [cats, items, recipes, stock] = await Promise.all([
    db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder)),
    db.select().from(menuRecipeLines),
    db.select().from(inventoryItems),
  ]);
  const stockById = new Map(stock.map((s) => [s.id, s.qtyOnHand]));
  const recipeByMenu = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const list = recipeByMenu.get(r.menuItemId) ?? [];
    list.push(r);
    recipeByMenu.set(r.menuItemId, list);
  }
  const catMap = new Map(cats.map((c) => [c.id, c]));

  return c.json({
    items: items.map((item) => {
      const recipe = recipeByMenu.get(item.id) ?? [];
      const sellableCount = computeSellableFromRecipe(recipe, stockById);
      const cat = catMap.get(item.categoryId);
      return {
        id: item.id,
        nameCz: item.nameCz,
        nameEn: item.nameEn,
        active: item.active,
        categoryId: item.categoryId,
        categoryNameCz: cat?.nameCz ?? null,
        sellableCount,
        hasRecipe: recipe.length > 0,
      };
    }),
  });
});

provozStockRouter.patch('/menu-items/:id/visibility', permProvozStock, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ active: z.boolean() }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(menuItems)
    .set({ active: parsed.data.active })
    .where(eq(menuItems.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.menuVisibility,
    entityType: 'menu_item',
    entityId: id,
    summary: `${row.active ? 'Zapnuto' : 'Vypnuto'} zobrazení: ${row.nameCz}`,
  });
  return c.json({ item: row });
});
