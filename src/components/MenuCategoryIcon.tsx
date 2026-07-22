import { getMenuCategoryIcon, isCustomMenuIcon } from '@/lib/menuIcons';

/** Ikona oddílu menu — Lucide klíč nebo nahraná URL. */
export function MenuCategoryIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  if (isCustomMenuIcon(iconKey)) {
    return <img src={iconKey} alt="" className={className ? `${className} object-contain` : 'object-contain'} />;
  }
  const Icon = getMenuCategoryIcon(iconKey);
  return <Icon className={className} />;
}
