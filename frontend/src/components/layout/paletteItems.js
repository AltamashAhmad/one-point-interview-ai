import { ADMIN_ITEMS, NAV_GROUPS } from './navItems';

/** Every page reachable from the sidebar, plus the admin pages for admins. */
export function buildPaletteItems(isAdmin) {
  const items = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label || 'General' })));
  return isAdmin ? [...items, ...ADMIN_ITEMS.map((item) => ({ ...item, group: 'Admin' }))] : items;
}

/** Case-insensitive match on the page name or its group; every typed word must match somewhere. */
export function filterPaletteItems(items, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = `${item.label} ${item.group}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
