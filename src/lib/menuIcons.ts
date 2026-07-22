import type { LucideIcon } from 'lucide-react';
import {
  Beef,
  Beer,
  Coffee,
  IceCream,
  Leaf,
  Pizza,
  Plus,
  Sandwich,
  Soup,
  Star,
  Utensils,
  Wheat,
  Wine,
} from 'lucide-react';

export const MENU_ICON_KEYS = [
  'beef',
  'soup',
  'sandwich',
  'star',
  'wheat',
  'ice-cream',
  'plus',
  'coffee',
  'utensils',
  'leaf',
  'pizza',
  'wine',
  'beer',
] as const;

export type MenuIconKey = (typeof MENU_ICON_KEYS)[number];

export const MENU_ICON_LABELS: Record<MenuIconKey, string> = {
  beef: 'Maso / burger',
  soup: 'Polévka / hot dog',
  sandwich: 'Sendvič',
  star: 'Hvězda / special',
  wheat: 'Obiloviny / přílohy',
  'ice-cream': 'Zmrzlina / sladké',
  plus: 'Plus / doplňky',
  coffee: 'Káva',
  utensils: 'Příbory',
  leaf: 'Salát / zelenina',
  pizza: 'Pizza',
  wine: 'Víno',
  beer: 'Pivo',
};

const ICON_MAP: Record<MenuIconKey, LucideIcon> = {
  beef: Beef,
  soup: Soup,
  sandwich: Sandwich,
  star: Star,
  wheat: Wheat,
  'ice-cream': IceCream,
  plus: Plus,
  coffee: Coffee,
  utensils: Utensils,
  leaf: Leaf,
  pizza: Pizza,
  wine: Wine,
  beer: Beer,
};

export function getMenuCategoryIcon(iconKey: string): LucideIcon {
  if (MENU_ICON_KEYS.includes(iconKey as MenuIconKey)) {
    return ICON_MAP[iconKey as MenuIconKey];
  }
  return Star;
}

/** Vlastní ikona nahraná na R2 (URL), jinak vestavěný Lucide klíč. */
export function isCustomMenuIcon(iconKey: string): boolean {
  return /^https?:\/\//i.test(iconKey.trim());
}
