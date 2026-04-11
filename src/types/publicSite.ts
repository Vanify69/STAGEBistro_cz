export type PublicMenuItem = {
  id: string;
  nameCz: string;
  nameEn: string;
  descCz: string | null;
  descEn: string | null;
  priceCents: number;
  allergenCodes: string | null;
  imageUrl: string | null;
  sortOrder: number;
};

export type PublicMenuCategory = {
  id: string;
  slug: string;
  nameCz: string;
  nameEn: string;
  sortOrder: number;
  items: PublicMenuItem[];
};

export type PublicGalleryImage = {
  id: string;
  url: string;
  altCz: string | null;
  altEn: string | null;
  sortOrder: number;
};

export type PublicHeaderEvent = {
  id: string;
  eventDate: string;
  timeText: string | null;
  titleCz: string;
  titleEn: string;
  subtitleCz: string;
  subtitleEn: string;
  linkUrl: string | null;
  sortOrder: number;
};

export type PublicSitePayload = {
  todayPrague: string;
  settings: Record<string, unknown>;
  menu: PublicMenuCategory[];
  gallery: PublicGalleryImage[];
  /** Akce pro nejbližší kalendářní den s `event_date >= dnes` (Europe/Prague); všechny sloty toho dne podle `sort_order`. */
  headerEventsToday: PublicHeaderEvent[];
};
