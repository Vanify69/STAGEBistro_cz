import './loadEnv.js';
import bcrypt from 'bcryptjs';
import { and, count, eq, gte, lte } from 'drizzle-orm';
import { getDb } from './db/index.js';
import {
  users,
  menuCategories,
  menuItems,
  galleryImages,
  siteSettings,
  headerEvents,
} from './db/schema.js';
import { strelakMay2026 } from './seedData/strelakMay2026.js';
import { CANONICAL_STRELECKY_EMBED_URL } from './lib/mapEmbedUrl.js';

async function main() {
  const db = getDb();
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@stagebistro.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!existing.length) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      role: 'admin',
    });
    console.log('Created admin user:', adminEmail);
  } else {
    console.log('Admin user already exists:', adminEmail);
  }

  const [catCountRow] = await db.select({ c: count() }).from(menuCategories);
  if ((catCountRow?.c ?? 0) > 0) {
    console.log('Menu already seeded, skipping menu/gallery.');
    await seedSettings(db);
    await seedHeaderEvents(db);
    return;
  }

  const cats = await db
    .insert(menuCategories)
    .values([
      { slug: 'burgers', sortOrder: 0, nameCz: 'Burgery', nameEn: 'Burgers' },
      { slug: 'hotdogs', sortOrder: 1, nameCz: 'Hot Dogs', nameEn: 'Hot Dogs' },
      { slug: 'sandwiches', sortOrder: 2, nameCz: 'Sendviče', nameEn: 'Sandwiches' },
      { slug: 'special', sortOrder: 3, nameCz: 'Special', nameEn: 'Special' },
      { slug: 'sides', sortOrder: 4, nameCz: 'Přílohy', nameEn: 'Sides' },
      { slug: 'sweets', sortOrder: 5, nameCz: 'Sladké', nameEn: 'Sweets' },
      { slug: 'addons', sortOrder: 6, nameCz: 'Doplňky', nameEn: 'Add-ons' },
    ])
    .returning();

  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id])) as Record<string, string>;

  type ItemInsert = typeof menuItems.$inferInsert;
  const itemRows: ItemInsert[] = [
    {
      categoryId: bySlug.burgers,
      sortOrder: 0,
      nameCz: 'Stage Loaded Burger',
      nameEn: 'Stage Loaded Burger',
      descCz: 'pulled pork, cheddar, coleslaw, křupavá cibulka, STAGE omáčka',
      descEn: 'pulled pork, cheddar, coleslaw, crispy onion, STAGE sauce',
      priceCents: 19900,
      allergenCodes: '1, 3, 7, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1571507622407-80df135676b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.burgers,
      sortOrder: 1,
      nameCz: 'Pulled Pork Burger',
      nameEn: 'Pulled Pork Burger',
      descCz: 'trhané vepřové, coleslaw, BBQ omáčka',
      descEn: 'pulled pork, coleslaw, BBQ sauce',
      priceCents: 17900,
      allergenCodes: '1, 3, 7, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1692197277937-c8d62dc93f18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.burgers,
      sortOrder: 2,
      nameCz: 'Veggie Burger',
      nameEn: 'Veggie Burger',
      descCz: 'grilovaný halloumi / veggie patty, rajče, salát, bylinková mayo',
      descEn: 'grilled halloumi / veggie patty, tomato, lettuce, herb mayo',
      priceCents: 18500,
      allergenCodes: '1, 3, 7',
      imageUrl:
        'https://images.unsplash.com/photo-1611309454921-16cef3438ee0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.hotdogs,
      sortOrder: 0,
      nameCz: 'Hot Dog Classic',
      nameEn: 'Hot Dog Classic',
      descCz: 'klobása, hořčice, kečup, křupavá cibulka',
      descEn: 'sausage, mustard, ketchup, crispy onion',
      priceCents: 10900,
      allergenCodes: '1, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1683882330145-d23cbe4f7ccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.hotdogs,
      sortOrder: 1,
      nameCz: 'Hot Dog Veggie',
      nameEn: 'Hot Dog Veggie',
      descCz: 'vegan párek, BBQ omáčka, cibulka',
      descEn: 'vegan sausage, BBQ sauce, onion',
      priceCents: 11500,
      allergenCodes: '1, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1774806266021-ec6926320aab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sandwiches,
      sortOrder: 0,
      nameCz: 'Chicken Sandwich',
      nameEn: 'Chicken Sandwich',
      descCz: 'kuřecí maso, mayo, salát',
      descEn: 'chicken, mayo, lettuce',
      priceCents: 11900,
      allergenCodes: '1, 3, 7',
      imageUrl:
        'https://images.unsplash.com/photo-1691775755286-139f5ac07dde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sandwiches,
      sortOrder: 1,
      nameCz: 'Beef Sandwich',
      nameEn: 'Beef Sandwich',
      descCz: 'hovězí maso, cibule, BBQ omáčka',
      descEn: 'beef, onion, BBQ sauce',
      priceCents: 12900,
      allergenCodes: '1, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sandwiches,
      sortOrder: 2,
      nameCz: 'Kids Baguette',
      nameEn: 'Kids Baguette',
      descCz: 'šunka, sýr, máslo',
      descEn: 'ham, cheese, butter',
      priceCents: 7900,
      allergenCodes: '1, 7',
      imageUrl:
        'https://images.unsplash.com/photo-1609670441507-478e600fbeb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.special,
      sortOrder: 0,
      nameCz: 'Leberkäse Sandwich',
      nameEn: 'Leberkäse Sandwich',
      descCz: 'leberkäse, hořčice, kyselá okurka',
      descEn: 'leberkäse, mustard, pickle',
      priceCents: 12900,
      allergenCodes: '1, 10',
      imageUrl:
        'https://images.unsplash.com/photo-1616205255807-b55f2513eced?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sides,
      sortOrder: 0,
      nameCz: 'Grilovaná kukuřice',
      nameEn: 'Grilled Corn',
      descCz: 'máslo / BBQ koření',
      descEn: 'butter / BBQ seasoning',
      priceCents: 7900,
      allergenCodes: '7',
      imageUrl:
        'https://images.unsplash.com/photo-1675266439041-15d522c4dcb7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sweets,
      sortOrder: 0,
      nameCz: 'Točená zmrzlina (malá)',
      nameEn: 'Soft Serve Ice Cream (small)',
      descCz: null,
      descEn: null,
      priceCents: 4900,
      allergenCodes: '7 (dle příchuti může obsahovat 1, 8)',
      imageUrl:
        'https://images.unsplash.com/photo-1594900543396-760a9add24ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.sweets,
      sortOrder: 1,
      nameCz: 'Točená zmrzlina (velká)',
      nameEn: 'Soft Serve Ice Cream (large)',
      descCz: null,
      descEn: null,
      priceCents: 6900,
      allergenCodes: '7 (dle příchuti může obsahovat 1, 8)',
      imageUrl:
        'https://images.unsplash.com/photo-1601302075320-278976647b70?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    },
    {
      categoryId: bySlug.addons,
      sortOrder: 0,
      nameCz: 'Extra sýr',
      nameEn: 'Extra cheese',
      descCz: null,
      descEn: null,
      priceCents: 2000,
      allergenCodes: null,
      imageUrl: null,
    },
    {
      categoryId: bySlug.addons,
      sortOrder: 1,
      nameCz: 'Extra omáčka',
      nameEn: 'Extra sauce',
      descCz: null,
      descEn: null,
      priceCents: 1500,
      allergenCodes: null,
      imageUrl: null,
    },
    {
      categoryId: bySlug.addons,
      sortOrder: 2,
      nameCz: 'Rajče / okurka',
      nameEn: 'Tomato / pickle',
      descCz: null,
      descEn: null,
      priceCents: 1000,
      allergenCodes: null,
      imageUrl: null,
    },
  ];

  await db.insert(menuItems).values(itemRows);

  await db.insert(galleryImages).values([
    {
      url: 'https://images.unsplash.com/photo-1765457436819-1ea7749d4506?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 0,
      altCz: 'Akce',
      altEn: 'Event',
    },
    {
      url: 'https://images.unsplash.com/photo-1765457408301-cb21e8866870?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 1,
      altCz: 'Akce',
      altEn: 'Event',
    },
    {
      url: 'https://images.unsplash.com/photo-1775213142758-a8280fd44356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 2,
      altCz: 'Akce',
      altEn: 'Event',
    },
    {
      url: 'https://images.unsplash.com/photo-1683731491956-28716b8bb618?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 3,
      altCz: 'Akce',
      altEn: 'Event',
    },
    {
      url: 'https://images.unsplash.com/photo-1717988241394-48c24220d13d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 4,
      altCz: 'Akce',
      altEn: 'Event',
    },
    {
      url: 'https://images.unsplash.com/photo-1774557936886-84837289433d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      sortOrder: 5,
      altCz: 'Akce',
      altEn: 'Event',
    },
  ]);

  await seedSettings(db);
  await seedHeaderEvents(db);
  console.log('Seed completed.');
}

async function seedSettings(db: ReturnType<typeof getDb>) {
  const pairs: [string, string][] = [
    ['tagline.cz', JSON.stringify('Street food vostrej jako šíp.')],
    ['tagline.en', JSON.stringify('Street food sharp as an arrow.')],
    ['location.cz', JSON.stringify('Střelecký ostrov, Praha')],
    ['location.en', JSON.stringify('Střelecký Island, Prague')],
    ['season.cz', JSON.stringify('Duben – Říjen')],
    ['season.en', JSON.stringify('April – October')],
    ['days.cz', JSON.stringify('Čt – Ne')],
    ['days.en', JSON.stringify('Thu – Sun')],
    ['service.cz', JSON.stringify('Rychlé občerstvení / takeaway')],
    ['service.en', JSON.stringify('Fast street food / takeaway')],
    ['about.cz', JSON.stringify('Rychlé jídlo. Kvalitní suroviny. Silná chuť. Stage Bistro přináší street food na jedno z nejhezčích míst v Praze.')],
    [
      'about.en',
      JSON.stringify(
        "Fast service. Quality ingredients. Bold flavors. Stage Bistro brings premium street food to one of Prague's most iconic locations."
      ),
    ],
    ['legal.companyName', JSON.stringify('Global Retail s.r.o.')],
    ['legal.ico', JSON.stringify('12345678')],
    ['legal.address', JSON.stringify('Střelecký ostrov, 110 00 Praha 1')],
    ['legal.email', JSON.stringify('info@stagebistro.cz')],
    ['map.embedUrl', JSON.stringify(CANONICAL_STRELECKY_EMBED_URL)],
    ['social.instagram', JSON.stringify('https://instagram.com/stagebistro')],
    ['social.facebook', JSON.stringify('https://facebook.com/stagebistro')],
    ['social.mapsQuery', JSON.stringify('https://maps.google.com/?q=Střelecký+ostrov+Praha')],
  ];
  for (const [key, value] of pairs) {
    await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { value },
    });
  }
}

async function seedHeaderEvents(db: ReturnType<typeof getDb>) {
  const from = strelakMay2026[0]?.eventDate;
  const to = strelakMay2026[strelakMay2026.length - 1]?.eventDate;
  if (!from || !to) return;

  const removed = await db
    .delete(headerEvents)
    .where(and(gte(headerEvents.eventDate, from), lte(headerEvents.eventDate, to)))
    .returning({ id: headerEvents.id });

  await db.insert(headerEvents).values(
    strelakMay2026.map((r, i) => ({
      eventDate: r.eventDate,
      timeText: r.timeText,
      titleCz: r.titleCz,
      titleEn: r.titleEn,
      subtitleCz: r.subtitleCz,
      subtitleEn: r.subtitleEn,
      linkUrl: null,
      sortOrder: i,
    }))
  );
  console.log(
    `Replaced header events in ${from}..${to}: removed ${removed.length}, inserted ${strelakMay2026.length}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
