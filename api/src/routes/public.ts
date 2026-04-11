import { Hono } from 'hono';
import { asc, eq, gte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  siteSettings,
  menuCategories,
  menuItems,
  galleryImages,
  headerEvents,
} from '../db/schema.js';
import { todayPragueYmd } from '../lib/pragueDate.js';
import { publicRateLimit } from '../middleware/rateLimit.js';
import { normalizeMapEmbedSettingValue } from '../lib/mapEmbedUrl.js';

export const publicRouter = new Hono();

publicRouter.get('/site', publicRateLimit, async (c) => {
  const db = getDb();
  const today = todayPragueYmd();

  const [settingsRows, categories, items, gallery, nextEventDay] = await Promise.all([
    db.select().from(siteSettings),
    db.select().from(menuCategories).where(eq(menuCategories.active, true)).orderBy(asc(menuCategories.sortOrder)),
    db.select().from(menuItems).where(eq(menuItems.active, true)).orderBy(asc(menuItems.sortOrder)),
    db.select().from(galleryImages).where(eq(galleryImages.active, true)).orderBy(asc(galleryImages.sortOrder)),
    db
      .select()
      .from(headerEvents)
      .where(gte(headerEvents.eventDate, today))
      .orderBy(asc(headerEvents.eventDate), asc(headerEvents.sortOrder))
      .limit(1),
  ]);

  const headerToday =
    nextEventDay[0] != null
      ? await db
          .select()
          .from(headerEvents)
          .where(eq(headerEvents.eventDate, nextEventDay[0].eventDate))
          .orderBy(asc(headerEvents.sortOrder))
      : [];

  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    try {
      settings[row.key] = JSON.parse(row.value) as unknown;
    } catch {
      settings[row.key] = row.value;
    }
  }
  if ('map.embedUrl' in settings) {
    settings['map.embedUrl'] = normalizeMapEmbedSettingValue(settings['map.embedUrl']);
  }

  const cats = categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    nameCz: cat.nameCz,
    nameEn: cat.nameEn,
    sortOrder: cat.sortOrder,
    items: items
      .filter((i) => i.categoryId === cat.id)
      .map((i) => ({
        id: i.id,
        nameCz: i.nameCz,
        nameEn: i.nameEn,
        descCz: i.descCz,
        descEn: i.descEn,
        priceCents: i.priceCents,
        allergenCodes: i.allergenCodes,
        imageUrl: i.imageUrl,
        sortOrder: i.sortOrder,
      })),
  }));

  return c.json({
    todayPrague: today,
    settings,
    menu: cats,
    gallery: gallery.map((g) => ({
      id: g.id,
      url: g.url,
      altCz: g.altCz,
      altEn: g.altEn,
      sortOrder: g.sortOrder,
    })),
    headerEventsToday: headerToday.map((e) => ({
      id: e.id,
      eventDate: e.eventDate,
      timeText: e.timeText,
      titleCz: e.titleCz,
      titleEn: e.titleEn,
      subtitleCz: e.subtitleCz,
      subtitleEn: e.subtitleEn,
      linkUrl: e.linkUrl,
      sortOrder: e.sortOrder,
    })),
  });
});
