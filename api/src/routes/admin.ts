import { Hono } from 'hono';
import { z } from 'zod';
import { asc, eq, and, gte, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  siteSettings,
  menuCategories,
  menuItems,
  galleryImages,
  headerEvents,
} from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { normalizeMapEmbedSettingValue } from '../lib/mapEmbedUrl.js';

export const adminRouter = new Hono<{ Variables: { user: AuthUser } }>();

adminRouter.use('*', requireAuth);
adminRouter.use('*', requireRole('admin'));

adminRouter.get('/settings', async (c) => {
  const db = getDb();
  const rows = await db.select().from(siteSettings);
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value) as unknown;
    } catch {
      settings[row.key] = row.value;
    }
  }
  if ('map.embedUrl' in settings) {
    settings['map.embedUrl'] = normalizeMapEmbedSettingValue(settings['map.embedUrl']);
  }
  return c.json({ settings });
});

const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});

adminRouter.patch('/settings', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  for (const [key, val] of Object.entries(parsed.data.settings)) {
    const normalizedVal = key === 'map.embedUrl' ? normalizeMapEmbedSettingValue(val) : val;
    // Always JSON-serialize so strings (e.g. IČ) are not stored as bare digits
    // (which JSON.parse would read back as numbers and break admin JSON + strSetting).
    const value = JSON.stringify(normalizedVal);
    await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { value },
    });
  }
  return c.json({ ok: true });
});

const categorySchema = z.object({
  slug: z.string().min(1),
  sortOrder: z.number().int().optional(),
  nameCz: z.string().min(1),
  nameEn: z.string().min(1),
  active: z.boolean().optional(),
});

adminRouter.get('/menu/categories', async (c) => {
  const db = getDb();
  const rows = await db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder));
  return c.json({ categories: rows });
});

adminRouter.post('/menu/categories', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .insert(menuCategories)
    .values({
      slug: parsed.data.slug,
      sortOrder: parsed.data.sortOrder ?? 0,
      nameCz: parsed.data.nameCz,
      nameEn: parsed.data.nameEn,
      active: parsed.data.active ?? true,
    })
    .returning();
  return c.json({ category: row }, 201);
});

adminRouter.patch('/menu/categories/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(menuCategories)
    .set({ ...parsed.data })
    .where(eq(menuCategories.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ category: row });
});

adminRouter.delete('/menu/categories/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
  return c.json({ ok: true });
});

const itemSchema = z.object({
  categoryId: z.string().uuid(),
  sortOrder: z.number().int().optional(),
  nameCz: z.string().min(1),
  nameEn: z.string().min(1),
  descCz: z.string().nullable().optional(),
  descEn: z.string().nullable().optional(),
  priceCents: z.number().int(),
  allergenCodes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

adminRouter.get('/menu/items', async (c) => {
  const db = getDb();
  const rows = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
  return c.json({ items: rows });
});

adminRouter.post('/menu/items', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .insert(menuItems)
    .values({
      categoryId: parsed.data.categoryId,
      sortOrder: parsed.data.sortOrder ?? 0,
      nameCz: parsed.data.nameCz,
      nameEn: parsed.data.nameEn,
      descCz: parsed.data.descCz ?? null,
      descEn: parsed.data.descEn ?? null,
      priceCents: parsed.data.priceCents,
      allergenCodes: parsed.data.allergenCodes ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();
  return c.json({ item: row }, 201);
});

adminRouter.patch('/menu/items/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = itemSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(menuItems)
    .set({ ...parsed.data })
    .where(eq(menuItems.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ item: row });
});

adminRouter.delete('/menu/items/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  await db.delete(menuItems).where(eq(menuItems.id, id));
  return c.json({ ok: true });
});

const gallerySchema = z.object({
  url: z.string().min(1),
  sortOrder: z.number().int().optional(),
  altCz: z.string().nullable().optional(),
  altEn: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

adminRouter.get('/gallery', async (c) => {
  const db = getDb();
  const rows = await db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder));
  return c.json({ images: rows });
});

adminRouter.post('/gallery', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = gallerySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .insert(galleryImages)
    .values({
      url: parsed.data.url,
      sortOrder: parsed.data.sortOrder ?? 0,
      altCz: parsed.data.altCz ?? null,
      altEn: parsed.data.altEn ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();
  return c.json({ image: row }, 201);
});

adminRouter.patch('/gallery/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = gallerySchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(galleryImages)
    .set({ ...parsed.data })
    .where(eq(galleryImages.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ image: row });
});

adminRouter.delete('/gallery/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  return c.json({ ok: true });
});

const headerEventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeText: z.string().nullable().optional(),
  titleCz: z.string().min(1),
  titleEn: z.string().min(1),
  subtitleCz: z.string().min(1),
  subtitleEn: z.string().min(1),
  linkUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

adminRouter.get('/header-events', async (c) => {
  const month = c.req.query('month');
  const db = getDb();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const end = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${last.toString().padStart(2, '0')}`;
    const filtered = await db
      .select()
      .from(headerEvents)
      .where(and(gte(headerEvents.eventDate, start), lte(headerEvents.eventDate, end)))
      .orderBy(asc(headerEvents.eventDate), asc(headerEvents.sortOrder));
    return c.json({ events: filtered });
  }
  const rows = await db.select().from(headerEvents).orderBy(asc(headerEvents.eventDate));
  return c.json({ events: rows });
});

adminRouter.post('/header-events', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = headerEventSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .insert(headerEvents)
    .values({
      eventDate: parsed.data.eventDate,
      timeText: parsed.data.timeText ?? null,
      titleCz: parsed.data.titleCz,
      titleEn: parsed.data.titleEn,
      subtitleCz: parsed.data.subtitleCz,
      subtitleEn: parsed.data.subtitleEn,
      linkUrl: parsed.data.linkUrl ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  return c.json({ event: row }, 201);
});

adminRouter.patch('/header-events/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = headerEventSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(headerEvents)
    .set({ ...parsed.data })
    .where(eq(headerEvents.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ event: row });
});

adminRouter.delete('/header-events/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  await db.delete(headerEvents).where(eq(headerEvents.id, id));
  return c.json({ ok: true });
});
