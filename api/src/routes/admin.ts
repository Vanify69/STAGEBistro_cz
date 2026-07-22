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
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { resolveMapEmbedUrlForSite } from '../lib/mapEmbedUrl.js';
import { isR2Configured, publicUrlForStorageKey, normalizePublicMediaUrl } from '../lib/s3.js';
import { putStorageBuffer } from '../lib/storage.js';
import { DEFAULT_MENU_ICON_KEY, MENU_ICON_KEYS } from '../lib/menuIconKeys.js';
import { auditAction, AUDIT_ACTIONS, writeAudit } from '../lib/auditLog.js';
import { adminUsersRouter } from './adminUsers.js';

export const adminRouter = new Hono<{ Variables: { user: AuthUser } }>();

adminRouter.use('*', requireAuth);
adminRouter.route('/', adminUsersRouter);

function withNormalizedImageUrl<T extends { imageUrl?: string | null }>(row: T): T {
  return { ...row, imageUrl: normalizePublicMediaUrl(row.imageUrl ?? null) };
}

adminRouter.get('/settings', requirePermission('site.settings'), async (c) => {
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
  settings['map.embedUrl'] = resolveMapEmbedUrlForSite(
    'map.embedUrl' in settings ? settings['map.embedUrl'] : ''
  );
  return c.json({ settings });
});

const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});

adminRouter.patch('/settings', requirePermission('site.settings'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const user = c.get('user');
  const db = getDb();
  for (const [key, val] of Object.entries(parsed.data.settings)) {
    const normalizedVal = key === 'map.embedUrl' ? resolveMapEmbedUrlForSite(val) : val;
    const value = JSON.stringify(normalizedVal);
    await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { value },
    });
  }
  await writeAudit({
    user,
    action: AUDIT_ACTIONS.site.settings,
    entityType: 'site_settings',
    summary: `Upravena nastavení webu (${Object.keys(parsed.data.settings).length} klíčů)`,
    metadata: { keys: Object.keys(parsed.data.settings) },
  });
  return c.json({ ok: true });
});

const menuIconKeySchema = z.enum(MENU_ICON_KEYS);

const categorySchema = z.object({
  slug: z.string().min(1),
  sortOrder: z.number().int().optional(),
  nameCz: z.string().min(1),
  nameEn: z.string().min(1),
  iconKey: menuIconKeySchema.optional(),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

adminRouter.get('/menu/categories', requirePermission('site.menu'), async (c) => {
  const db = getDb();
  const rows = await db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder));
  return c.json({ categories: rows.map(withNormalizedImageUrl) });
});

adminRouter.post('/menu/categories', requirePermission('site.menu'), async (c) => {
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
      iconKey: parsed.data.iconKey ?? DEFAULT_MENU_ICON_KEY,
      imageUrl: normalizePublicMediaUrl(parsed.data.imageUrl ?? null),
      active: parsed.data.active ?? true,
    })
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuCategoryCreate,
    entityType: 'menu_category',
    entityId: row!.id,
    summary: `Nová kategorie menu: ${row!.nameCz}`,
  });
  return c.json({ category: withNormalizedImageUrl(row!) }, 201);
});

adminRouter.patch('/menu/categories/:id', requirePermission('site.menu'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const data = { ...parsed.data };
  if ('imageUrl' in data) {
    data.imageUrl = normalizePublicMediaUrl(data.imageUrl ?? null);
  }
  const [row] = await db
    .update(menuCategories)
    .set(data)
    .where(eq(menuCategories.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuCategoryUpdate,
    entityType: 'menu_category',
    entityId: id,
    summary: `Upravena kategorie menu: ${row.nameCz}`,
  });
  return c.json({ category: withNormalizedImageUrl(row) });
});

adminRouter.delete('/menu/categories/:id', requirePermission('site.menu'), async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [existing] = await db.select().from(menuCategories).where(eq(menuCategories.id, id)).limit(1);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuCategoryDelete,
    entityType: 'menu_category',
    entityId: id,
    summary: `Smazána kategorie menu: ${existing.nameCz}`,
  });
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

adminRouter.get('/menu/items', requirePermission('site.menu'), async (c) => {
  const db = getDb();
  const rows = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
  return c.json({ items: rows.map(withNormalizedImageUrl) });
});

adminRouter.post('/menu/items', requirePermission('site.menu'), async (c) => {
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
      imageUrl: normalizePublicMediaUrl(parsed.data.imageUrl ?? null),
      active: parsed.data.active ?? true,
    })
    .returning();
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuItemCreate,
    entityType: 'menu_item',
    entityId: row!.id,
    summary: `Nová položka menu: ${row!.nameCz}`,
  });
  return c.json({ item: withNormalizedImageUrl(row!) }, 201);
});

adminRouter.patch('/menu/items/:id', requirePermission('site.menu'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = itemSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const data = { ...parsed.data };
  if ('imageUrl' in data) {
    data.imageUrl = normalizePublicMediaUrl(data.imageUrl ?? null);
  }
  const [row] = await db
    .update(menuItems)
    .set(data)
    .where(eq(menuItems.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuItemUpdate,
    entityType: 'menu_item',
    entityId: id,
    summary: `Upravena položka menu: ${row.nameCz}`,
  });
  return c.json({ item: withNormalizedImageUrl(row) });
});

adminRouter.delete('/menu/items/:id', requirePermission('site.menu'), async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(menuItems).where(eq(menuItems.id, id));
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.menuItemDelete,
    entityType: 'menu_item',
    entityId: id,
    summary: `Smazána položka menu: ${existing.nameCz}`,
  });
  return c.json({ ok: true });
});

const uploadPurposeSchema = z.enum(['menu-item', 'menu-category', 'menu-hero']);
const MAX_ADMIN_IMAGE_BYTES = 12 * 1024 * 1024;

/** Starý klient (cached JS) volá presign — vrať JSON hlášku místo plain 404. */
adminRouter.post('/uploads/presign', requirePermission('site.menu'), async (c) => {
  return c.json(
    {
      error:
        'Nahrávání bylo změněno. Obnovte stránku pomocí Ctrl+Shift+R (nebo vyčistěte cache) a nahrajte fotku znovu.',
    },
    410
  );
});

/** Nahrání obrázku přes API → R2 (bez browser PUT / CORS na bucketu). */
adminRouter.post('/uploads', requirePermission('site.menu'), async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'Nahrávání není nakonfigurováno (R2)' }, 503);
  }
  if (!process.env.R2_PUBLIC_BASE_URL?.trim()) {
    return c.json({ error: 'Chybí R2_PUBLIC_BASE_URL pro veřejné URL obrázků' }, 503);
  }

  const contentType = (c.req.header('content-type') ?? '').toLowerCase();
  let purposeRaw = c.req.query('purpose') ?? '';
  let mime = 'image/jpeg';
  let bytes: Uint8Array;

  if (contentType.includes('multipart/form-data')) {
    const body = await c.req.parseBody({ all: true });
    const purposeField = body['purpose'];
    if (typeof purposeField === 'string') purposeRaw = purposeField;
    const fileField = body['file'];
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!file || typeof file === 'string') {
      return c.json({ error: 'Chybí soubor (field file)' }, 400);
    }
    mime = (file.type || 'image/jpeg').split(';')[0]!.trim().toLowerCase() || 'image/jpeg';
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    mime = contentType.split(';')[0]!.trim() || 'image/jpeg';
    bytes = new Uint8Array(await c.req.arrayBuffer());
  }

  const purposeParsed = uploadPurposeSchema.safeParse(purposeRaw);
  if (!purposeParsed.success) {
    return c.json({ error: 'Neplatný purpose (menu-item | menu-category | menu-hero)' }, 400);
  }
  if (!mime.startsWith('image/')) {
    return c.json({ error: 'Podporovány jsou jen obrázky' }, 400);
  }
  if (bytes.length === 0) return c.json({ error: 'Prázdný soubor' }, 400);
  if (bytes.length > MAX_ADMIN_IMAGE_BYTES) {
    return c.json({ error: 'Soubor je příliš velký (max 12 MB)' }, 400);
  }

  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const storageKey = `${purposeParsed.data}/${crypto.randomUUID()}.${ext}`;
  try {
    await putStorageBuffer(storageKey, bytes, mime);
  } catch (err) {
    console.error('[admin/uploads] R2 put failed', err);
    const detail = err instanceof Error ? err.message : 'unknown';
    return c.json({ error: `Uložení souboru do R2 selhalo: ${detail}` }, 502);
  }
  const publicUrl = publicUrlForStorageKey(storageKey);
  return c.json({ publicUrl, storageKey });
});

const gallerySchema = z.object({
  url: z.string().min(1),
  sortOrder: z.number().int().optional(),
  altCz: z.string().nullable().optional(),
  altEn: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

adminRouter.get('/gallery', requirePermission('site.gallery'), async (c) => {
  const db = getDb();
  const rows = await db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder));
  return c.json({ images: rows });
});

adminRouter.post('/gallery', requirePermission('site.gallery'), async (c) => {
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
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.galleryCreate,
    entityType: 'gallery_image',
    entityId: row!.id,
    summary: 'Přidán obrázek do galerie',
  });
  return c.json({ image: row }, 201);
});

adminRouter.patch('/gallery/:id', requirePermission('site.gallery'), async (c) => {
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
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.galleryUpdate,
    entityType: 'gallery_image',
    entityId: id,
    summary: 'Upraven obrázek v galerii',
  });
  return c.json({ image: row });
});

adminRouter.delete('/gallery/:id', requirePermission('site.gallery'), async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [existing] = await db.select().from(galleryImages).where(eq(galleryImages.id, id)).limit(1);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.galleryDelete,
    entityType: 'gallery_image',
    entityId: id,
    summary: 'Smazán obrázek z galerie',
  });
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

adminRouter.get('/header-events', requirePermission('site.events'), async (c) => {
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

adminRouter.post('/header-events', requirePermission('site.events'), async (c) => {
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
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.eventCreate,
    entityType: 'header_event',
    entityId: row!.id,
    summary: `Nová akce v hlavičce: ${row!.titleCz} (${row!.eventDate})`,
  });
  return c.json({ event: row }, 201);
});

adminRouter.patch('/header-events/:id', requirePermission('site.events'), async (c) => {
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
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.eventUpdate,
    entityType: 'header_event',
    entityId: id,
    summary: `Upravena akce v hlavičce: ${row.titleCz}`,
  });
  return c.json({ event: row });
});

adminRouter.delete('/header-events/:id', requirePermission('site.events'), async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [existing] = await db.select().from(headerEvents).where(eq(headerEvents.id, id)).limit(1);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(headerEvents).where(eq(headerEvents.id, id));
  await auditAction(c, {
    action: AUDIT_ACTIONS.site.eventDelete,
    entityType: 'header_event',
    entityId: id,
    summary: `Smazána akce v hlavičce: ${existing.titleCz}`,
  });
  return c.json({ ok: true });
});
