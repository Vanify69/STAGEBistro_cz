import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Instagram, Facebook, MapPin, ChevronDown, Beef, Sandwich, Star, Wheat, IceCream, Plus, Soup } from 'lucide-react';
import LogoImage from '../imports/Logo_web.png';
import FaviconImage from '../imports/Favicon.png';

type Language = 'cz' | 'en';

const translations = {
  cz: {
    tagline: 'Street food vostrej jako šíp.',
    menuBtn: 'Menu',
    findBtn: 'Kde nás najdeš',
    location: 'Střelecký ostrov, Praha',
    season: 'Duben – Říjen',
    days: 'Čt – Ne',
    service: 'Rychlé občerstvení / takeaway',
    menuTitle: 'Menu',
    qrText: 'Naskenuj QR pro menu v mobilu',
    aboutTitle: 'O nás',
    aboutText: 'Rychlé jídlo. Kvalitní suroviny. Silná chuť. Stage Bistro přináší street food na jedno z nejhezčích míst v Praze.',
    locationTitle: 'Kde nás najdeš',
    getDirections: 'Navigovat',
    legalTitle: 'Provozovatel',
    email: 'Email',
    menu: {
      burgers: 'Burgery',
      hotdogs: 'Hot Dogs',
      sandwiches: 'Sendviče',
      special: 'Special',
      sides: 'Přílohy',
      sweets: 'Sladké',
      addons: 'Doplňky',
    },
    items: {
      stageLoaded: {
        name: 'Stage Loaded Burger',
        desc: 'pulled pork, cheddar, coleslaw, křupavá cibulka, STAGE omáčka',
        allergens: '1, 3, 7, 10',
      },
      pulledPork: {
        name: 'Pulled Pork Burger',
        desc: 'trhané vepřové, coleslaw, BBQ omáčka',
        allergens: '1, 3, 7, 10',
      },
      veggieBurger: {
        name: 'Veggie Burger',
        desc: 'grilovaný halloumi / veggie patty, rajče, salát, bylinková mayo',
        allergens: '1, 3, 7',
      },
      hotdogClassic: {
        name: 'Hot Dog Classic',
        desc: 'klobása, hořčice, kečup, křupavá cibulka',
        allergens: '1, 10',
      },
      hotdogVeggie: {
        name: 'Hot Dog Veggie',
        desc: 'vegan párek, BBQ omáčka, cibulka',
        allergens: '1, 10',
      },
      chickenSandwich: {
        name: 'Chicken Sandwich',
        desc: 'kuřecí maso, mayo, salát',
        allergens: '1, 3, 7',
      },
      beefSandwich: {
        name: 'Beef Sandwich',
        desc: 'hovězí maso, cibule, BBQ omáčka',
        allergens: '1, 10',
      },
      kidsBaguette: {
        name: 'Kids Baguette',
        desc: 'šunka, sýr, máslo',
        allergens: '1, 7',
      },
      leberkase: {
        name: 'Leberkäse Sandwich',
        desc: 'leberkäse, hořčice, kyselá okurka',
        allergens: '1, 10',
      },
      corn: {
        name: 'Grilovaná kukuřice',
        desc: 'máslo / BBQ koření',
        allergens: '7',
      },
      iceCreamSmall: {
        name: 'Točená zmrzlina (malá)',
        allergens: '7 (dle příchuti může obsahovat 1, 8)',
      },
      iceCreamLarge: {
        name: 'Točená zmrzlina (velká)',
        allergens: '7 (dle příchuti může obsahovat 1, 8)',
      },
      extraCheese: {
        name: 'Extra sýr',
      },
      extraSauce: {
        name: 'Extra omáčka',
      },
      extraVeggies: {
        name: 'Rajče / okurka',
      },
    },
    allergensNote: 'Alergeny na vyžádání / QR',
    allergensLabel: 'Alergeny',
    eventsTitle: 'Naše akce',
    eventsSubtitle: 'Potkejte nás na různých místech v Praze',
    nextEvent: 'Příští akce',
    nextEventDate: '30.4. čt',
    nextEventLocation: 'Čarodějnice na ostrově • 13:00',
  },
  en: {
    tagline: 'Street food sharp as an arrow.',
    menuBtn: 'Menu',
    findBtn: 'Find us',
    location: 'Střelecký Island, Prague',
    season: 'April – October',
    days: 'Thu – Sun',
    service: 'Fast street food / takeaway',
    menuTitle: 'Menu',
    qrText: 'Scan QR for mobile menu',
    aboutTitle: 'About',
    aboutText: "Fast service. Quality ingredients. Bold flavors. Stage Bistro brings premium street food to one of Prague's most iconic locations.",
    locationTitle: 'Find us',
    getDirections: 'Get directions',
    legalTitle: 'Operator',
    email: 'Email',
    menu: {
      burgers: 'Burgers',
      hotdogs: 'Hot Dogs',
      sandwiches: 'Sandwiches',
      special: 'Special',
      sides: 'Sides',
      sweets: 'Sweets',
      addons: 'Add-ons',
    },
    items: {
      stageLoaded: {
        name: 'Stage Loaded Burger',
        desc: 'pulled pork, cheddar, coleslaw, crispy onion, STAGE sauce',
        allergens: '1, 3, 7, 10',
      },
      pulledPork: {
        name: 'Pulled Pork Burger',
        desc: 'pulled pork, coleslaw, BBQ sauce',
        allergens: '1, 3, 7, 10',
      },
      veggieBurger: {
        name: 'Veggie Burger',
        desc: 'grilled halloumi / veggie patty, tomato, lettuce, herb mayo',
        allergens: '1, 3, 7',
      },
      hotdogClassic: {
        name: 'Hot Dog Classic',
        desc: 'sausage, mustard, ketchup, crispy onion',
        allergens: '1, 10',
      },
      hotdogVeggie: {
        name: 'Hot Dog Veggie',
        desc: 'vegan sausage, BBQ sauce, onion',
        allergens: '1, 10',
      },
      chickenSandwich: {
        name: 'Chicken Sandwich',
        desc: 'chicken, mayo, lettuce',
        allergens: '1, 3, 7',
      },
      beefSandwich: {
        name: 'Beef Sandwich',
        desc: 'beef, onion, BBQ sauce',
        allergens: '1, 10',
      },
      kidsBaguette: {
        name: 'Kids Baguette',
        desc: 'ham, cheese, butter',
        allergens: '1, 7',
      },
      leberkase: {
        name: 'Leberkäse Sandwich',
        desc: 'leberkäse, mustard, pickle',
        allergens: '1, 10',
      },
      corn: {
        name: 'Grilled Corn',
        desc: 'butter / BBQ seasoning',
        allergens: '7',
      },
      iceCreamSmall: {
        name: 'Soft Serve Ice Cream (small)',
        allergens: '7 (may contain 1, 8 depending on flavor)',
      },
      iceCreamLarge: {
        name: 'Soft Serve Ice Cream (large)',
        allergens: '7 (may contain 1, 8 depending on flavor)',
      },
      extraCheese: {
        name: 'Extra cheese',
      },
      extraSauce: {
        name: 'Extra sauce',
      },
      extraVeggies: {
        name: 'Tomato / pickle',
      },
    },
    allergensNote: 'Allergens on request / QR',
    allergensLabel: 'Allergens',
    eventsTitle: 'Our Events',
    eventsSubtitle: 'Find us at various locations in Prague',
    nextEvent: 'Next event',
    nextEventDate: 'Apr 30 Thu',
    nextEventLocation: "Witches' Night on the Island • 1PM",
  },
};

export default function App() {
  const [lang, setLang] = useState<Language>('cz');
  const menuRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Fixed Header with Logo, Event Banner & Language Toggle */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Event Banner - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <Star className="w-4 h-4" />
              <span className="text-black/60">{t.nextEvent}:</span>
              <span className="font-medium">{t.nextEventDate}</span>
              <span className="text-black/40">•</span>
              <span className="text-black/60">{t.nextEventLocation}</span>
            </div>

            <div className="md:hidden"></div>

            {/* Language Toggle */}
            <div className="flex gap-1 border border-black/20 rounded-full p-1">
              <button
                onClick={() => setLang('cz')}
                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                  lang === 'cz' ? 'bg-black text-white' : 'text-black/60 hover:text-black'
                }`}
              >
                CZ
              </button>
              <button
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

      {/* Hero Section */}
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
            {t.tagline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={() => scrollToSection(menuRef)}
              className="w-full sm:w-auto px-10 py-4 bg-white text-black hover:bg-white/90 transition-colors text-base tracking-wide"
            >
              {t.menuBtn}
            </button>
            <button
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

      {/* Quick Info Bar */}
      <section className="border-b border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="border-r border-black/10 last:border-r-0">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">
                {lang === 'cz' ? 'Lokace' : 'Location'}
              </div>
              <div className="text-sm font-light">{t.location}</div>
            </div>
            <div className="border-r border-black/10 lg:border-r">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">
                {lang === 'cz' ? 'Sezóna' : 'Season'}
              </div>
              <div className="text-sm font-light">{t.season}</div>
            </div>
            <div className="border-r border-black/10 last:border-r-0">
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">
                {lang === 'cz' ? 'Otevřeno' : 'Open'}
              </div>
              <div className="text-sm font-light">{t.days}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-black/50 mb-2">
                {lang === 'cz' ? 'Typ' : 'Type'}
              </div>
              <div className="text-sm font-light">{t.service}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
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
            <div className="w-24 h-px bg-black mx-auto"></div>
          </motion.div>

          {/* Burgers */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Beef className="w-8 h-8" />
              {t.menu.burgers}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.stageLoaded.name}
                desc={t.items.stageLoaded.desc}
                price="199 Kč"
                allergens={t.items.stageLoaded.allergens}
                allergensLabel={t.allergensLabel}
                image="https://images.unsplash.com/photo-1571507622407-80df135676b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.pulledPork.name}
                desc={t.items.pulledPork.desc}
                price="179 Kč"
                allergens={t.items.pulledPork.allergens}
                allergensLabel={t.allergensLabel}
                image="https://images.unsplash.com/photo-1692197277937-c8d62dc93f18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.veggieBurger.name}
                desc={t.items.veggieBurger.desc}
                price="185 Kč"
                allergens={t.items.veggieBurger.allergens}
                allergensLabel={t.allergensLabel}
                image="https://images.unsplash.com/photo-1611309454921-16cef3438ee0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Hot Dogs */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Soup className="w-8 h-8" />
              {t.menu.hotdogs}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.hotdogClassic.name}
                desc={t.items.hotdogClassic.desc}
                price="109 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.hotdogClassic.allergens}
                image="https://images.unsplash.com/photo-1683882330145-d23cbe4f7ccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.hotdogVeggie.name}
                desc={t.items.hotdogVeggie.desc}
                price="115 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.hotdogVeggie.allergens}
                image="https://images.unsplash.com/photo-1774806266021-ec6926320aab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Sandwiches */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Sandwich className="w-8 h-8" />
              {t.menu.sandwiches}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.chickenSandwich.name}
                desc={t.items.chickenSandwich.desc}
                price="119 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.chickenSandwich.allergens}
                image="https://images.unsplash.com/photo-1691775755286-139f5ac07dde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.beefSandwich.name}
                desc={t.items.beefSandwich.desc}
                price="129 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.beefSandwich.allergens}
                image="https://images.unsplash.com/photo-1539252554453-80ab65ce3586?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.kidsBaguette.name}
                desc={t.items.kidsBaguette.desc}
                price="79 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.kidsBaguette.allergens}
                image="https://images.unsplash.com/photo-1609670441507-478e600fbeb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Special */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Star className="w-8 h-8" />
              {t.menu.special}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.leberkase.name}
                desc={t.items.leberkase.desc}
                price="129 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.leberkase.allergens}
                image="https://images.unsplash.com/photo-1616205255807-b55f2513eced?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Sides */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Wheat className="w-8 h-8" />
              {t.menu.sides}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.corn.name}
                desc={t.items.corn.desc}
                price="79 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.corn.allergens}
                image="https://images.unsplash.com/photo-1675266439041-15d522c4dcb7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Sweets */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <IceCream className="w-8 h-8" />
              {t.menu.sweets}
            </h3>
            <div className="space-y-8">
              <MenuItem
                name={t.items.iceCreamSmall.name}
                price="49 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.iceCreamSmall.allergens}
                image="https://images.unsplash.com/photo-1594900543396-760a9add24ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
              <MenuItem
                name={t.items.iceCreamLarge.name}
                price="69 Kč"
                allergensLabel={t.allergensLabel}
                allergens={t.items.iceCreamLarge.allergens}
                image="https://images.unsplash.com/photo-1601302075320-278976647b70?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
              />
            </div>
          </div>

          {/* Add-ons */}
          <div className="mb-16">
            <h3 className="text-2xl sm:text-3xl mb-8 tracking-tight flex items-center gap-3">
              <Plus className="w-8 h-8" />
              {t.menu.addons}
            </h3>
            <div className="space-y-4">
              <MenuItem
                name={t.items.extraCheese.name}
                price="20 Kč"
              />
              <MenuItem
                name={t.items.extraSauce.name}
                price="15 Kč"
              />
              <MenuItem
                name={t.items.extraVeggies.name}
                price="10 Kč"
              />
            </div>
          </div>

          {/* Allergens Note */}
          <div className="text-center text-sm text-black/60 mb-12">
            <p>{t.allergensNote}</p>
          </div>

          {/* QR Code Section */}
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

      {/* Events Section */}
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
            <div className="w-24 h-px bg-black mx-auto mb-4"></div>
            <p className="text-lg text-black/60">{t.eventsSubtitle}</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1765457436819-1ea7749d4506?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1765457408301-cb21e8866870?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1775213142758-a8280fd44356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1683731491956-28716b8bb618?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1717988241394-48c24220d13d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="aspect-square overflow-hidden bg-black/5"
            >
              <img
                src="https://images.unsplash.com/photo-1774557936886-84837289433d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600"
                alt="Event"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 sm:py-32 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-5xl tracking-tight mb-8">{t.aboutTitle}</h2>
            <p className="text-lg sm:text-xl font-light leading-relaxed max-w-3xl mx-auto">
              {t.aboutText}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Location Section */}
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
            <div className="w-24 h-px bg-black mx-auto"></div>
          </motion.div>

          <div className="aspect-[16/9] mb-8 overflow-hidden rounded-lg border border-black/10">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2560.469792983!2d14.408682815674686!3d50.08055597942795!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x470b94ec19676c3d%3A0x400af0f6615bcf0!2zxaB0xZllbGVja8O9IG9zdHJvdiwgMTEwIDAwIFByYWhhIDEtU3RhcsOpIE3Em3N0bw!5e0!3m2!1scs!2scz!4v1234567890123!5m2!1scs!2scz"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Stage Bistro Location - Střelecký ostrov"
            ></iframe>
          </div>

          <div className="text-center">
            <a
              href="https://maps.google.com/?q=Střelecký+ostrov+Praha"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 bg-black text-white hover:bg-black/90 transition-colors text-base tracking-wide"
            >
              {t.getDirections}
            </a>
          </div>
        </div>
      </section>

      {/* Social Section */}
      <section className="border-t border-b border-black/10 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center gap-8">
            <a
              href="https://instagram.com/stagebistro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black/60 hover:text-black transition-colors"
            >
              <Instagram className="w-6 h-6" />
            </a>
            <a
              href="https://facebook.com/stagebistro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black/60 hover:text-black transition-colors"
            >
              <Facebook className="w-6 h-6" />
            </a>
          </div>
        </div>
      </section>

      {/* Company Info / Legal */}
      <section className="py-16 bg-white border-b border-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-black/60 space-y-2">
            <h3 className="text-base text-black mb-4">{t.legalTitle}</h3>
            <p>Global Retail s.r.o.</p>
            <p>IČO: 12345678</p>
            <p>Střelecký ostrov, 110 00 Praha 1</p>
            <p className="pt-4">
              {t.email}: <a href="mailto:info@stagebistro.cz" className="hover:text-black transition-colors">info@stagebistro.cz</a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img
            src={LogoImage}
            alt="Stage Bistro"
            className="w-full max-w-lg mx-auto"
          />
        </div>
      </footer>
    </div>
  );
}

function MenuItem({
  name,
  desc,
  price,
  allergens,
  allergensLabel,
  image
}: {
  name: string;
  desc?: string;
  price: string;
  allergens?: string;
  allergensLabel?: string;
  image?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group"
    >
      <div className="flex gap-6">
        {image && (
          <div className="w-32 h-32 flex-shrink-0 overflow-hidden bg-black/5">
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <div className="flex-1 flex justify-between items-start gap-4">
          <div className="flex-1">
            <h4 className="text-lg tracking-wide mb-2 uppercase">{name}</h4>
            {desc && <p className="text-sm text-black/60 font-light leading-relaxed mb-2">{desc}</p>}
            {allergens && allergensLabel && (
              <p className="text-xs text-black/40">
                {allergensLabel}: {allergens}
              </p>
            )}
          </div>
          <div className="text-lg tracking-wide whitespace-nowrap font-medium">{price}</div>
        </div>
      </div>
    </motion.div>
  );
}
