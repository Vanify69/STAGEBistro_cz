import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  orderEmailTemplates,
  purchaseOrderLines,
  purchaseOrders,
  supplierItems,
  suppliers,
} from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import {
  permProvozOrders,
  permProvozOrdersRead,
  permProvozOrdersSend,
} from '../lib/staffRoutePermissions.js';
import { auditAction, AUDIT_ACTIONS } from '../lib/auditLog.js';
import { isSmtpConfigured, sendMail } from '../lib/mail.js';
import {
  formatOrderDate,
  formatOrderLines,
  noteBlock,
  orderSenderLabel,
  renderOrderTemplate,
} from '../lib/orderMail.js';

export const provozOrdersRouter = new Hono<{ Variables: { user: AuthUser } }>();

provozOrdersRouter.use('*', requireAuth);

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const supplierItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  defaultQty: z.string().max(40).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  subjectTemplate: z.string().min(1).max(500),
  bodyTemplate: z.string().min(1).max(20000),
});

const orderLineSchema = z.object({
  supplierItemId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(40).optional(),
  quantity: z.string().min(1).max(40),
  lineNote: z.string().max(500).nullable().optional(),
});

const createOrderSchema = z.object({
  supplierId: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
  lines: z.array(orderLineSchema).min(1),
});

async function getOrCreateTemplate() {
  const db = getDb();
  const existing = await db.select().from(orderEmailTemplates).limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(orderEmailTemplates)
    .values({
      name: 'Výchozí',
      subjectTemplate: 'Objednávka STAGE Bistro — {{datum}}',
      bodyTemplate:
        'Dobrý den,\n\nprosíme o závoz pro Stage Bistro:\n\n{{polozky}}\n\n{{poznamka}}\n\nDěkujeme\n{{odeslal}}',
    })
    .returning();
  return row!;
}

async function loadOrderBundle(orderId: string) {
  const db = getDb();
  const orders = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1);
  const order = orders[0];
  if (!order) return null;
  const supplierRows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, order.supplierId))
    .limit(1);
  const lines = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.orderId, orderId))
    .orderBy(asc(purchaseOrderLines.nameSnapshot));
  return { order, supplier: supplierRows[0] ?? null, lines };
}

function buildRenderedMail(opts: {
  subjectTemplate: string;
  bodyTemplate: string;
  supplierName: string;
  note: string | null | undefined;
  lines: { nameSnapshot: string; unitSnapshot: string; quantity: string; lineNote: string | null }[];
  sender: string;
}) {
  const vars = {
    datum: formatOrderDate(),
    dodavatel: opts.supplierName,
    polozky: formatOrderLines(opts.lines),
    poznamka: noteBlock(opts.note),
    odeslal: opts.sender,
  };
  return {
    subject: renderOrderTemplate(opts.subjectTemplate, vars),
    body: renderOrderTemplate(opts.bodyTemplate, vars),
  };
}

provozOrdersRouter.get('/suppliers', permProvozOrdersRead, async (c) => {
  const db = getDb();
  const includeInactive = c.req.query('all') === '1';
  const rows = includeInactive
    ? await db.select().from(suppliers).orderBy(asc(suppliers.sortOrder), asc(suppliers.name))
    : await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.active, true))
        .orderBy(asc(suppliers.sortOrder), asc(suppliers.name));
  return c.json({ suppliers: rows });
});

provozOrdersRouter.post('/suppliers', permProvozOrders, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .insert(suppliers)
    .values({
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim(),
      phone: parsed.data.phone?.trim() || null,
      note: parsed.data.note?.trim() || null,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.supplierCreate,
    entityType: 'supplier',
    entityId: row!.id,
    summary: `Nový dodavatel ${row!.name}`,
  });
  return c.json({ supplier: row }, 201);
});

provozOrdersRouter.patch('/suppliers/:id', permProvozOrders, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = supplierSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const patch: Partial<typeof suppliers.$inferInsert> = {};
  if (parsed.data.name != null) patch.name = parsed.data.name.trim();
  if (parsed.data.email != null) patch.email = parsed.data.email.trim();
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone?.trim() || null;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note?.trim() || null;
  if (parsed.data.active != null) patch.active = parsed.data.active;
  if (parsed.data.sortOrder != null) patch.sortOrder = parsed.data.sortOrder;
  const [row] = await db.update(suppliers).set(patch).where(eq(suppliers.id, id)).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.supplierUpdate,
    entityType: 'supplier',
    entityId: id,
    summary: `Upraven dodavatel ${row.name}`,
  });
  return c.json({ supplier: row });
});

provozOrdersRouter.get('/suppliers/:id/items', permProvozOrdersRead, async (c) => {
  const id = c.req.param('id');
  const includeInactive = c.req.query('all') === '1';
  const db = getDb();
  const rows = await db
    .select()
    .from(supplierItems)
    .where(
      includeInactive
        ? eq(supplierItems.supplierId, id)
        : and(eq(supplierItems.supplierId, id), eq(supplierItems.active, true))
    )
    .orderBy(asc(supplierItems.sortOrder), asc(supplierItems.name));
  return c.json({ items: rows });
});

provozOrdersRouter.post('/suppliers/:id/items', permProvozOrders, async (c) => {
  const supplierId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = supplierItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const supplier = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!supplier[0]) return c.json({ error: 'Supplier not found' }, 404);
  const [row] = await db
    .insert(supplierItems)
    .values({
      supplierId,
      name: parsed.data.name.trim(),
      unit: parsed.data.unit.trim(),
      defaultQty: parsed.data.defaultQty?.trim() || null,
      note: parsed.data.note?.trim() || null,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.supplierItemCreate,
    entityType: 'supplier_item',
    entityId: row!.id,
    summary: `Nová položka ${row!.name}`,
    metadata: { supplierId },
  });
  return c.json({ item: row }, 201);
});

provozOrdersRouter.patch('/supplier-items/:id', permProvozOrders, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = supplierItemSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const patch: Partial<typeof supplierItems.$inferInsert> = {};
  if (parsed.data.name != null) patch.name = parsed.data.name.trim();
  if (parsed.data.unit != null) patch.unit = parsed.data.unit.trim();
  if (parsed.data.defaultQty !== undefined) patch.defaultQty = parsed.data.defaultQty?.trim() || null;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note?.trim() || null;
  if (parsed.data.active != null) patch.active = parsed.data.active;
  if (parsed.data.sortOrder != null) patch.sortOrder = parsed.data.sortOrder;
  const [row] = await db.update(supplierItems).set(patch).where(eq(supplierItems.id, id)).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.supplierItemUpdate,
    entityType: 'supplier_item',
    entityId: id,
    summary: `Upravena položka ${row.name}`,
  });
  return c.json({ item: row });
});

provozOrdersRouter.get('/order-template', permProvozOrdersRead, async (c) => {
  const template = await getOrCreateTemplate();
  return c.json({ template });
});

provozOrdersRouter.put('/order-template', permProvozOrders, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const existing = await getOrCreateTemplate();
  const db = getDb();
  const [row] = await db
    .update(orderEmailTemplates)
    .set({
      name: parsed.data.name?.trim() || existing.name,
      subjectTemplate: parsed.data.subjectTemplate,
      bodyTemplate: parsed.data.bodyTemplate,
      updatedAt: new Date(),
    })
    .where(eq(orderEmailTemplates.id, existing.id))
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.orderTemplateUpdate,
    entityType: 'order_email_template',
    entityId: row!.id,
    summary: 'Upravena šablona e-mailu objednávky',
  });
  return c.json({ template: row });
});

provozOrdersRouter.get('/orders', permProvozOrdersRead, async (c) => {
  const db = getDb();
  const limit = Math.min(Number(c.req.query('limit') ?? '50') || 50, 200);
  const orders = await db
    .select()
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(limit);
  if (orders.length === 0) return c.json({ orders: [] });

  const supplierIds = [...new Set(orders.map((o) => o.supplierId))];
  const orderIds = orders.map((o) => o.id);
  const supplierRows = await db.select().from(suppliers).where(inArray(suppliers.id, supplierIds));
  const lineRows = await db
    .select()
    .from(purchaseOrderLines)
    .where(inArray(purchaseOrderLines.orderId, orderIds));

  const supplierMap = new Map(supplierRows.map((s) => [s.id, s]));
  const linesByOrder = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push(line);
    linesByOrder.set(line.orderId, list);
  }

  return c.json({
    orders: orders.map((o) => ({
      ...o,
      supplier: supplierMap.get(o.supplierId) ?? null,
      lines: linesByOrder.get(o.id) ?? [],
    })),
  });
});

provozOrdersRouter.get('/orders/:id', permProvozOrdersRead, async (c) => {
  const bundle = await loadOrderBundle(c.req.param('id'));
  if (!bundle) return c.json({ error: 'Not found' }, 404);
  return c.json(bundle);
});

provozOrdersRouter.post('/orders', permProvozOrdersSend, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const user = c.get('user');
  const db = getDb();

  const supplierRows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, parsed.data.supplierId))
    .limit(1);
  const supplier = supplierRows[0];
  if (!supplier || !supplier.active) return c.json({ error: 'Dodavatel nenalezen' }, 404);

  const itemIds = parsed.data.lines
    .map((l) => l.supplierItemId)
    .filter((id): id is string => Boolean(id));
  const catalog =
    itemIds.length > 0
      ? await db
          .select()
          .from(supplierItems)
          .where(and(eq(supplierItems.supplierId, supplier.id), inArray(supplierItems.id, itemIds)))
      : [];
  const catalogMap = new Map(catalog.map((i) => [i.id, i]));

  const resolvedLines: {
    supplierItemId: string | null;
    nameSnapshot: string;
    unitSnapshot: string;
    quantity: string;
    lineNote: string | null;
  }[] = [];

  for (const line of parsed.data.lines) {
    const item = line.supplierItemId ? catalogMap.get(line.supplierItemId) : undefined;
    const nameSnapshot = (item?.name ?? line.name ?? '').trim();
    const unitSnapshot = (item?.unit ?? line.unit ?? 'ks').trim();
    if (!nameSnapshot) return c.json({ error: 'Každý řádek musí mít název' }, 400);
    resolvedLines.push({
      supplierItemId: item?.id ?? null,
      nameSnapshot,
      unitSnapshot,
      quantity: line.quantity.trim(),
      lineNote: line.lineNote?.trim() || null,
    });
  }

  const [order] = await db
    .insert(purchaseOrders)
    .values({
      supplierId: supplier.id,
      status: 'draft',
      note: parsed.data.note?.trim() || null,
      createdBy: user.id,
    })
    .returning();

  const insertedLines = await db
    .insert(purchaseOrderLines)
    .values(resolvedLines.map((l) => ({ ...l, orderId: order!.id })))
    .returning();

  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.orderCreate,
    entityType: 'purchase_order',
    entityId: order!.id,
    summary: `Návrh objednávky pro ${supplier.name}`,
    metadata: { lineCount: insertedLines.length },
  });

  return c.json({ order, supplier, lines: insertedLines }, 201);
});

provozOrdersRouter.post('/orders/:id/preview', permProvozOrdersSend, async (c) => {
  const bundle = await loadOrderBundle(c.req.param('id'));
  if (!bundle || !bundle.supplier) return c.json({ error: 'Not found' }, 404);
  const template = await getOrCreateTemplate();
  const user = c.get('user');
  const rendered = buildRenderedMail({
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    supplierName: bundle.supplier.name,
    note: bundle.order.note,
    lines: bundle.lines,
    sender: orderSenderLabel(user),
  });
  return c.json({
    to: bundle.supplier.email,
    subject: rendered.subject,
    body: rendered.body,
  });
});

provozOrdersRouter.post('/orders/:id/send', permProvozOrdersSend, async (c) => {
  const id = c.req.param('id');
  const bundle = await loadOrderBundle(id);
  if (!bundle || !bundle.supplier) return c.json({ error: 'Not found' }, 404);
  if (bundle.order.status === 'sent') {
    return c.json({ error: 'Objednávka už byla odeslána', order: bundle.order }, 409);
  }
  if (bundle.lines.length === 0) return c.json({ error: 'Objednávka nemá položky' }, 400);

  const user = c.get('user');
  const template = await getOrCreateTemplate();
  const rendered = buildRenderedMail({
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    supplierName: bundle.supplier.name,
    note: bundle.order.note,
    lines: bundle.lines,
    sender: orderSenderLabel(user),
  });

  const db = getDb();

  if (!isSmtpConfigured()) {
    const [failed] = await db
      .update(purchaseOrders)
      .set({
        status: 'failed',
        emailSubject: rendered.subject,
        emailBody: rendered.body,
        errorMessage: 'SMTP není nakonfigurováno',
      })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return c.json({ order: failed, emailed: false, error: 'SMTP není nakonfigurováno' }, 503);
  }

  try {
    await sendMail({
      to: bundle.supplier.email,
      subject: rendered.subject,
      text: rendered.body,
      html: rendered.body.replace(/\n/g, '<br>\n'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [failed] = await db
      .update(purchaseOrders)
      .set({
        status: 'failed',
        emailSubject: rendered.subject,
        emailBody: rendered.body,
        errorMessage: message,
      })
      .where(eq(purchaseOrders.id, id))
      .returning();
    console.error('[purchase-order] Odeslání selhalo:', err);
    return c.json({ order: failed, emailed: false, error: message }, 502);
  }

  const [sent] = await db
    .update(purchaseOrders)
    .set({
      status: 'sent',
      emailSubject: rendered.subject,
      emailBody: rendered.body,
      errorMessage: null,
      sentAt: new Date(),
      sentBy: user.id,
    })
    .where(eq(purchaseOrders.id, id))
    .returning();

  await auditAction(c, {
    action: AUDIT_ACTIONS.provoz.orderSend,
    entityType: 'purchase_order',
    entityId: id,
    summary: `Objednávka odeslána: ${bundle.supplier.name}`,
    metadata: { to: bundle.supplier.email },
  });

  return c.json({ order: sent, emailed: true });
});
