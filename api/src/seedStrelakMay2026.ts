import './loadEnv.js';
import { and, gte, lte } from 'drizzle-orm';
import { getDb } from './db/index.js';
import { headerEvents } from './db/schema.js';
import { strelakMay2026 } from './seedData/strelakMay2026.js';

async function main() {
  const db = getDb();
  const del = await db
    .delete(headerEvents)
    .where(and(gte(headerEvents.eventDate, '2026-04-30'), lte(headerEvents.eventDate, '2026-05-31')))
    .returning({ id: headerEvents.id });
  console.log(`Removed ${del.length} existing header_event rows in 2026-04-30 … 2026-05-31.`);

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
  console.log(`Inserted ${strelakMay2026.length} Střelák May 2026 events.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
