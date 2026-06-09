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

export const DEFAULT_MENU_ICON_KEY: MenuIconKey = 'star';

export function iconKeyFromCategorySlug(slug: string): MenuIconKey {
  switch (slug) {
    case 'burgers':
      return 'beef';
    case 'hotdogs':
      return 'soup';
    case 'sandwiches':
      return 'sandwich';
    case 'special':
      return 'star';
    case 'sides':
      return 'wheat';
    case 'sweets':
      return 'ice-cream';
    case 'addons':
      return 'plus';
    default:
      return DEFAULT_MENU_ICON_KEY;
  }
}
