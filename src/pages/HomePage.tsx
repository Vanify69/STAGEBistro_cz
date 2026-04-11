import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import {
  Instagram,
  Facebook,
  ChevronDown,
  Beef,
  Sandwich,
  Star,
  Wheat,
  IceCream,
  Plus,
  Soup,
} from 'lucide-react';
import LogoImage from '../imports/Logo_web.png';
import { apiFetch } from '@/lib/api';
import type { PublicSitePayload } from '@/types/publicSite';
import { MenuItemBlock } from '@/app/components/MenuItemBlock';

type Language = 'cz' | 'en';

const ui = {
  cz: {
    menuBtn: 'Menu',
    findBtn: 'Kde nás najdeš',
    menuTitle: 'Menu',
    qrText: 'Naskenuj QR pro menu v mobilu',
    aboutTitle: 'O nás',
    locationTitle: 'Kde nás najdeš',
    getDirections: 'Navigovat',
    legalTitle: 'Provozovatel',
    emailLabel: 'Email',
    allergensNote: 'Alergeny na vyžádání / QR',
    allergensLabel: 'Alergeny',
    eventsTitle: 'Naše akce',
    eventsSubtitle: 'Potkejte nás na různých místech v Praze',
    nextEvent: 'Příští akce',
    locLabel: 'Lokace',
    seasonLabel: 'Sezóna',
    openLabel: 'Otevřeno',
    typeLabel: 'Typ',
  },
  en: {
    menuBtn: 'Menu',
    findBtn: 'Find us',
    menuTitle: 'Menu',
    qrText: 'Scan QR for mobile menu',
    aboutTitle: 'About',
    locationTitle: 'Find us',
    getDirections: 'Get directions',
    legalTitle: 'Operator',
    emailLabel: 'Email',
    allergensNote: 'Allergens on request / QR',
    allergensLabel: 'Allergens',
    eventsTitle: 'Our Events',
    eventsSubtitle: 'Find us at various locations in Prague',
    nextEvent: 'Next event',
    locLabel: 'Location',
    seasonLabel: 'Season',
    openLabel: 'Open',
    typeLabel: 'Type',
  },
} as const;

function strSetting(settings: Record<string, unknown>, key: string, fallback: string): string {
  const v = settings[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function formatKc(cents: number): string {
  return `${Math.round(cents / 100)} Kč`;
}

function HeaderEventMarquee({ text }: { text: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return;
    const update = () => {
      setOverflow(measure.scrollWidth > outer.clientWidth + 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [text]);

  const durationSec = Math.min(48, Math.max(14, text.length * 0.1));

  const scrollableRm = overflow && reducedMotion;

  return (
    <div
      ref={outerRef}
      className={`relative min-w-0 flex-1 text-black/80 ${scrollableRm ? 'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'overflow-hidden'}`}
      title={text}
    >
      <span
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 z-[-1] whitespace-nowrap opacity-0"
        aria-hidden
      >
        {text}
      </span>
      {overflow && !reducedMotion ? (
        <div className="header-event-marquee-track" style={{ ['--header-marquee-sec' as string]: `${durationSec}s` }}>
          <span className="shrink-0 whitespace-nowrap pr-10">{text}</span>
          <span className="shrink-0 whitespace-nowrap pr-10">{text}</span>
        </div>
      ) : scrollableRm ? (
        <div className="whitespace-nowrap pr-2">{text}</div>
      ) : (
        <div className="truncate whitespace-nowrap">{text}</div>
      )}
    </div>
  );
}

function categoryIcon(slug: string) {
  switch (slug) {
    case 'burgers':
      return Beef;
    case 'hotdogs':
      return Soup;
    case 'sandwiches':
      return Sandwich;
    case 'special':
      return Star;
    case 'sides':
      return Wheat;
    case 'sweets':
      return IceCream;
    case 'addons':
      return Plus;
    default:
      return Star;
  }
}

export default function HomePage() {
  const [lang, setLang] = useState<Language>('cz');
  const menuRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const t = ui[lang];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public', 'site'],
    queryFn: () => apiFetch<PublicSitePayload>('/api/public/site'),
  });

  const settings = data?.settings ?? {};
  const tagline = strSetting(settings, lang === 'cz' ? 'tagline.cz' : 'tagline.en', '');
  const location = strSetting(settings, lang === 'cz' ? 'location.cz' : 'location.en', '');
  const season = strSetting(settings, lang === 'cz' ? 'season.cz' : 'season.en', '');
  const days = strSetting(settings, lang === 'cz' ? 'days.cz' : 'days.en', '');
  const service = strSetting(settings, lang === 'cz' ? 'service.cz' : 'service.en', '');
  const about = strSetting(settings, lang === 'cz' ? 'about.cz' : 'about.en', '');
  const mapEmbed = strSetting(settings, 'map.embedUrl', '');
  const mapsLink = strSetting(settings, 'social.mapsQuery', 'https://maps.google.com/?q=Střelecký+ostrov+Praha');
  const instagram = strSetting(settings, 'social.instagram', 'https://instagram.com/stagebistro');
  const facebook = strSetting(settings, 'social.facebook', 'https://facebook.com/stagebistro');
  const company = strSetting(settings, 'legal.companyName', 'Global Retail s.r.o.');
  const ico = strSetting(settings, 'legal.ico', '12345678');
  const address = strSetting(settings, 'legal.address', 'Střelecký ostrov, 110 00 Praha 1');
  const email = strSetting(settings, 'legal.email', 'info@stagebistro.cz');

  const headerLine = useMemo(() => {
    const ev = data?.headerEventsToday?.[0];
    const today = data?.todayPrague;
    if (!today) return { date: '', place: '' };
    const formatYmd = (ymd: string) => {
      try {
        return format(parseISO(ymd), lang === 'cz' ? 'd.M. EEE' : 'MMM d EEE', {
          locale: lang === 'cz' ? cs : enUS,
        });
      } catch {
        return ymd;
      }
    };
    let dateStr = formatYmd(today);
    if (!ev) {
      return { date: dateStr, place: lang === 'cz' ? 'Žádná akce v plánu' : 'No event scheduled' };
    }
    dateStr = formatYmd(ev.eventDate);
    const title = lang === 'cz' ? ev.titleCz : ev.titleEn;
    const sub = lang === 'cz' ? ev.subtitleCz : ev.subtitleEn;
    const time = ev.timeText ? ` • ${ev.timeText}` : '';
    return { date: dateStr, place: `${title} — ${sub}${time}` };
  }, [data, lang]);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm">
              <Star className="w-3.5 h-3.5 shrink-0 text-black/50 sm:h-4 sm:w-4" />
              <HeaderEventMarquee text={`${t.nextEvent}: ${headerLine.date} • ${headerLine.place}`} />
            </div>
            <div className="flex shrink-0 gap-1 border border-black/20 rounded-full p-1">
              <button
                type="button"
                onClick={() => setLang('cz')}
                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                  lang === 'cz' ? 'bg-black text-white' : 'text-black/60 hover:text-black'
                }`}
              >
                CZ
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                  lang === 'en' ? 'bg-black text-white' : 'text-black/60 hover:text-black'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <section className="min-h-screen flex items-center justify-center bg-black text-white px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-4xl"
        >
          <img src={LogoImage} alt="Stage Bistro" className="w-full max-w-2xl mx-auto mb-8" />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-xl sm:text-2xl mb-12 tracking-wide font-light"
          >
            {isLoading ? '…' : tagline}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              type="button"
              onClick={() => scrollToSection(menuRef)}
              className="w-full sm:w-auto px-10 py-4 bg-white text-black hover:bg-white/90 transition-colors text-base tracking-wide"
            >
              {t.menuBtn}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(locationRef)}
              className="w-full sm:w-auto px-10 py-4 border border-white hover:bg-white hover:text-black transition-colors text-base tracking-wide"
            >
              {t.findBtn}
            </button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-16"
          >
            <ChevronDown className="w-6 h-6 mx-auto animate-bounce opacity-50" />
          </motion.div>
        </motion.div>
      </section>

      <section className="border-b border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="border-r border-black/10 last:border-r-0">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">{t.locLabel}</div>
              <div className="text-sm font-light">{location}</div>
            </div>
            <div className="border-r border-black/10 lg:border-r">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">{t.seasonLabel}</div>
              <div className="text-sm font-light">{season}</div>
            </div>
            <div className="border-r border-black/10 last:border-r-0">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">{t.openLabel}</div>
              <div className="text-sm font-light">{days}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">{t.typeLabel}</div>
              <div className="text-sm font-light">{service}</div>
            </div>
          </div>
        </div>
      </section>

      <section ref={menuRef} className="py-20 sm:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-6xl tracking-tight mb-4">{t.menuTitle}</h2>
            <div className="w-24 h-px bg-black mx-auto" />
          </motion.div>

          {isError && (
            <p className="text-center text-red-600 mb-8">
              {(error as Error).message}
            </p>
          )}

          {(data?.menu ?? []).map((cat) => {
            const Icon = categoryIcon(cat.slug);
            const catName = lang === 'cz' ? cat.nameCz : cat.nameEn;
            return (
              <div key={cat.id} className="mb-16">
                <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
                  <Icon className="w-8 h-8" />
                  {catName}
                </h3>
                <div className="space-y-8">
                  {cat.items.map((item) => (
                    <MenuItemBlock
                      key={item.id}
                      name={lang === 'cz' ? item.nameCz : item.nameEn}
                      desc={(lang === 'cz' ? item.descCz : item.descEn) ?? undefined}
                      price={formatKc(item.priceCents)}
                      allergens={item.allergenCodes ?? undefined}
                      allergensLabel={t.allergensLabel}
                      image={item.imageUrl ?? undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="text-center text-sm text-black/60 mb-12">
            <p>{t.allergensNote}</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center border border-black/10 p-12"
          >
            <div className="w-32 h-32 bg-black/5 mx-auto mb-6 flex items-center justify-center">
              <div className="text-xs text-black/40">[QR CODE]</div>
            </div>
            <p className="text-sm tracking-wide text-black/60">{t.qrText}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-6xl tracking-tight mb-4">{t.eventsTitle}</h2>
            <div className="w-24 h-px bg-black mx-auto mb-4" />
            <p className="text-lg text-black/60">{t.eventsSubtitle}</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(data?.gallery ?? []).map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * (i % 8) }}
                className="aspect-square overflow-hidden bg-black/5"
              >
                <img
                  src={g.url}
                  alt={(lang === 'cz' ? g.altCz : g.altEn) ?? 'Event'}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-32 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-5xl tracking-tight mb-8">{t.aboutTitle}</h2>
            <p className="text-lg sm:text-xl font-light leading-relaxed max-w-3xl mx-auto">{about}</p>
          </motion.div>
        </div>
      </section>

      <section ref={locationRef} className="py-20 sm:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-6xl tracking-tight mb-4">{t.locationTitle}</h2>
            <div className="w-24 h-px bg-black mx-auto" />
          </motion.div>
          {mapEmbed && (
            <div className="aspect-[16/9] mb-8 overflow-hidden rounded-lg border border-black/10">
              <iframe
                src={mapEmbed}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Stage Bistro Location"
              />
            </div>
          )}
          <div className="text-center">
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 bg-black text-white hover:bg-black/90 transition-colors text-base tracking-wide"
            >
              {t.getDirections}
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-b border-black/10 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center gap-8">
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-black/60 hover:text-black transition-colors">
              <Instagram className="w-6 h-6" />
            </a>
            <a href={facebook} target="_blank" rel="noopener noreferrer" className="text-black/60 hover:text-black transition-colors">
              <Facebook className="w-6 h-6" />
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-black/60 space-y-2">
            <h3 className="text-base text-black mb-4">{t.legalTitle}</h3>
            <p>{company}</p>
            <p>IČO: {ico}</p>
            <p>{address}</p>
            <p className="pt-4">
              {t.emailLabel}:{' '}
              <a href={`mailto:${email}`} className="hover:text-black transition-colors">
                {email}
              </a>
            </p>
            <p className="pt-2 text-xs">
              <Link to="/login" className="underline hover:text-black">
                {lang === 'cz' ? 'Vstup pro personál' : 'Staff login'}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-black text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img src={LogoImage} alt="Stage Bistro" className="w-full max-w-lg mx-auto" />
        </div>
      </footer>
    </div>
  );
}
