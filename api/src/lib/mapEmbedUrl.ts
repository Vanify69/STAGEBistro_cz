/**
 * Google Maps „Vložit mapu“ často vloží celý <iframe …>.
 * V DB a v `iframe src` má být jen HTTPS URL z atributu src.
 */
export const CANONICAL_STRELECKY_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2560.284102763644!2d14.409968499999996!3d50.0809675!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x470b94faea108a65%3A0x2976fda7e2980053!2sSt%C5%99eleck%C3%BD%20ostrov%2C%20110%2000%20Praha%201!5e0!3m2!1scs!2scz!4v1775945747459!5m2!1scs!2scz';

/** Střelecký ostrov ~50.08; Pustověty ~50.31 — embed s vyšší „mapovou“ šířkou je skoro jistě špatně. */
const MAX_LAT_FOR_THIS_VENUE = 50.14;

export function normalizeGoogleMapsEmbedInput(input: string): string {
  let t = input.trim();
  if (!t) return '';
  t = t.replace(/&amp;/g, '&');
  const lower = t.toLowerCase();
  if (lower.includes('<iframe')) {
    const quoted = t.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (quoted?.[1]) return quoted[1].trim().replace(/&amp;/g, '&');
    const unquoted = t.match(/\bsrc\s*=\s*(https?:\/\/[^\s>]+)/i);
    if (unquoted?.[1]) return unquoted[1].trim().replace(/&amp;/g, '&');
  }
  return t;
}

export function normalizeMapEmbedSettingValue(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  return normalizeGoogleMapsEmbedInput(val);
}

function maxLatFromGoogleEmbedPb(url: string): number | null {
  const matches = [...url.matchAll(/!3d(50\.\d+)/g)];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => parseFloat(m[1])));
}

/** Vrátí URL pro iframe — opraví iframe-vložku, prázdnou hodnotu a typické „špatné“ embedy (např. Pustověty). */
export function resolveMapEmbedUrlForSite(val: unknown): string {
  const n = normalizeMapEmbedSettingValue(val);
  const url = typeof n === 'string' ? n.trim() : '';
  if (!url) return CANONICAL_STRELECKY_EMBED_URL;
  if (/pustov/i.test(url)) return CANONICAL_STRELECKY_EMBED_URL;
  const lat = maxLatFromGoogleEmbedPb(url);
  if (lat != null && lat > MAX_LAT_FOR_THIS_VENUE) return CANONICAL_STRELECKY_EMBED_URL;
  return url;
}
