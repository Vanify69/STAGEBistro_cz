import { inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { siteSettings } from '../db/schema.js';

const KEYS = [
  'employer_name',
  'employer_address',
  'employer_ico',
  'employer_signatory',
  'default_work_place',
  'employer_signature_storage_key',
] as const;

export type EmployerSettings = {
  name: string;
  address: string;
  ico: string;
  signatory: string;
  defaultWorkPlace: string;
  signatureStorageKey: string | null;
};

const DEFAULTS: EmployerSettings = {
  name: 'Stage Gastro s.r.o.',
  address: 'Nové sady 988/2, Staré Brno, 602 00 Brno',
  ico: '24973726',
  signatory: 'jednatel',
  defaultWorkPlace: 'PRAHA',
  signatureStorageKey: null,
};

export async function getEmployerSettings(): Promise<EmployerSettings> {
  const db = getDb();
  const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, [...KEYS]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const unquote = (v: string | undefined, fallback: string) => {
    if (!v) return fallback;
    try {
      const parsed = JSON.parse(v) as unknown;
      return typeof parsed === 'string' ? parsed : v;
    } catch {
      return v;
    }
  };
  return {
    name: unquote(map.employer_name, DEFAULTS.name),
    address: unquote(map.employer_address, DEFAULTS.address),
    ico: unquote(map.employer_ico, DEFAULTS.ico),
    signatory: unquote(map.employer_signatory, DEFAULTS.signatory),
    defaultWorkPlace: unquote(map.default_work_place, DEFAULTS.defaultWorkPlace),
    signatureStorageKey: map.employer_signature_storage_key
      ? unquote(map.employer_signature_storage_key, '')
      : null,
  };
}
