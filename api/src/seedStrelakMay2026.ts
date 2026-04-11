import './loadEnv.js';
import { and, gte, lte } from 'drizzle-orm';
import { getDb } from './db/index.js';
import { headerEvents } from './db/schema.js';

type Row = {
  eventDate: string;
  timeText: string;
  titleCz: string;
  titleEn: string;
  subtitleCz: string;
  subtitleEn: string;
};

/** Střelák – květen 2026 (včetně 30. 4.), zdroj: provozní harmonogram */
const strelakMay2026: Row[] = [
  {
    eventDate: '2026-04-30',
    timeText: '13:00',
    titleCz: 'Čarodějnice na ostrově',
    titleEn: 'Witches on the island',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-01',
    timeText: '13:00',
    titleCz: 'Wine party na ostrově',
    titleEn: 'Wine party on the island',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-02',
    timeText: '13:00',
    titleCz: 'Wine party na ostrově',
    titleEn: 'Wine party on the island',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-03',
    timeText: '18:30',
    titleCz: 'O.J Žlábek duo',
    titleEn: 'O.J Žlábek duo',
    subtitleCz: 'blues',
    subtitleEn: 'blues',
  },
  {
    eventDate: '2026-05-04',
    timeText: '18:30',
    titleCz: 'Paul Batto',
    titleEn: 'Paul Batto',
    subtitleCz: 'blues rock',
    subtitleEn: 'blues rock',
  },
  {
    eventDate: '2026-05-05',
    timeText: '18:30',
    titleCz: 'Plamperová',
    titleEn: 'Plamperová',
    subtitleCz: 'Ženy jako krajina',
    subtitleEn: 'Women as landscape',
  },
  {
    eventDate: '2026-05-06',
    timeText: '18:30',
    titleCz: 'Johnny Cash Tribute show',
    titleEn: 'Johnny Cash Tribute show',
    subtitleCz: 'folk',
    subtitleEn: 'folk',
  },
  {
    eventDate: '2026-05-07',
    timeText: '13:00',
    titleCz: 'Festival francouzských chutí',
    titleEn: 'Festival of French flavors',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-08',
    timeText: '13:00',
    titleCz: 'Festival francouzských chutí',
    titleEn: 'Festival of French flavors',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-09',
    timeText: '13:00',
    titleCz: 'Festival francouzských chutí',
    titleEn: 'Festival of French flavors',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-10',
    timeText: '18:30',
    titleCz: 'The Furnitures',
    titleEn: 'The Furnitures',
    subtitleCz: 'pop',
    subtitleEn: 'pop',
  },
  {
    eventDate: '2026-05-11',
    timeText: '18:30',
    titleCz: 'Mrakoplaš',
    titleEn: 'Mrakoplaš',
    subtitleCz: 'folk',
    subtitleEn: 'folk',
  },
  {
    eventDate: '2026-05-12',
    timeText: '18:30',
    titleCz: 'Jakub Daš s kapelou',
    titleEn: 'Jakub Daš with band',
    subtitleCz: 'alternative folk',
    subtitleEn: 'alternative folk',
  },
  {
    eventDate: '2026-05-13',
    timeText: '18:30',
    titleCz: 'Guy Bennet',
    titleEn: 'Guy Bennet',
    subtitleCz: 'blues, pop, rock',
    subtitleEn: 'blues, pop, rock',
  },
  {
    eventDate: '2026-05-14',
    timeText: '17:00',
    titleCz: 'GROOVISM',
    titleEn: 'GROOVISM',
    subtitleCz: 'deep tech / minimal',
    subtitleEn: 'deep tech / minimal',
  },
  {
    eventDate: '2026-05-15',
    timeText: '17:00',
    titleCz: 'AAU Spring Music and Arts Festival',
    titleEn: 'AAU Spring Music and Arts Festival',
    subtitleCz: 'studentský festival',
    subtitleEn: 'student festival',
  },
  {
    eventDate: '2026-05-16',
    timeText: '18:30',
    titleCz: 'd.n.acoustic',
    titleEn: 'd.n.acoustic',
    subtitleCz: 'folk alternative',
    subtitleEn: 'folk alternative',
  },
  {
    eventDate: '2026-05-17',
    timeText: '18:30',
    titleCz: 'Ian Kelosky',
    titleEn: 'Ian Kelosky',
    subtitleCz: 'pop, blues, folk',
    subtitleEn: 'pop, blues, folk',
  },
  {
    eventDate: '2026-05-18',
    timeText: '18:30',
    titleCz: 'Lautrec',
    titleEn: 'Lautrec',
    subtitleCz: 'alternative folk',
    subtitleEn: 'alternative folk',
  },
  {
    eventDate: '2026-05-19',
    timeText: '19:00',
    titleCz: 'otázka času',
    titleEn: 'otázka času',
    subtitleCz: 'pop folk',
    subtitleEn: 'pop folk',
  },
  {
    eventDate: '2026-05-20',
    timeText: '18:30',
    titleCz: 'BEA.K',
    titleEn: 'BEA.K',
    subtitleCz: 'alternative pop',
    subtitleEn: 'alternative pop',
  },
  {
    eventDate: '2026-05-21',
    timeText: '18:30',
    titleCz: 'Surfellow',
    titleEn: 'Surfellow',
    subtitleCz: 'folk',
    subtitleEn: 'folk',
  },
  {
    eventDate: '2026-05-22',
    timeText: '13:00',
    titleCz: 'Vinařské slavnosti',
    titleEn: 'Wine festival',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-23',
    timeText: '13:00',
    titleCz: 'Vinařské slavnosti',
    titleEn: 'Wine festival',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-24',
    timeText: '16:00',
    titleCz: 'KHAMORO',
    titleEn: 'KHAMORO',
    subtitleCz: 'festival romské kultury',
    subtitleEn: 'Romani culture festival',
  },
  {
    eventDate: '2026-05-25',
    timeText: '18:30',
    titleCz: 'Helena Kalambová',
    titleEn: 'Helena Kalambová',
    subtitleCz: 'alternative pop',
    subtitleEn: 'alternative pop',
  },
  {
    eventDate: '2026-05-26',
    timeText: '17:00',
    titleCz: 'BE GOOD – DJ Brady & Saxman',
    titleEn: 'BE GOOD – DJ Brady & Saxman',
    subtitleCz: 'house DJ & live sax',
    subtitleEn: 'house DJ & live sax',
  },
  {
    eventDate: '2026-05-27',
    timeText: '19:00',
    titleCz: 'Holan a Carban',
    titleEn: 'Holan a Carban',
    subtitleCz: 'coutrycká masáž',
    subtitleEn: 'coutrycká masáž',
  },
  {
    eventDate: '2026-05-28',
    timeText: '18:30',
    titleCz: 'Cispol',
    titleEn: 'Cispol',
    subtitleCz: 'folk',
    subtitleEn: 'folk',
  },
  {
    eventDate: '2026-05-29',
    timeText: '13:00',
    titleCz: 'Wine Fiesta',
    titleEn: 'Wine Fiesta',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-30',
    timeText: '13:00',
    titleCz: 'Wine Fiesta',
    titleEn: 'Wine Fiesta',
    subtitleCz: 'music & wine & food festival',
    subtitleEn: 'music & wine & food festival',
  },
  {
    eventDate: '2026-05-31',
    timeText: '15:00',
    titleCz: 'Přijďte si s námi zahrát',
    titleEn: 'Come play with us',
    subtitleCz: 'koncert NF Hramonie',
    subtitleEn: 'NF Hramonie concert',
  },
];

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
