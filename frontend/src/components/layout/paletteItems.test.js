import { describe, it, expect } from 'vitest';
import { buildPaletteItems, filterPaletteItems } from './paletteItems';

describe('buildPaletteItems', () => {
  it('lists every sidebar page and only adds admin pages for admins', () => {
    const user = buildPaletteItems(false).map((i) => i.label);
    const admin = buildPaletteItems(true).map((i) => i.label);

    expect(user).toEqual(expect.arrayContaining(['Home', 'DSA', 'Notes', 'DSA Sheet', 'Prep Plan', 'History']));
    expect(user).not.toContain('Admin panel');
    expect(admin).toEqual(expect.arrayContaining(['Admin panel', 'Prompt generator']));
  });

  it('labels each page with its sidebar group', () => {
    const items = buildPaletteItems(false);

    expect(items.find((i) => i.label === 'Notes').group).toBe('Learn');
    expect(items.find((i) => i.label === 'Home').group).toBe('General');
  });
});

describe('filterPaletteItems', () => {
  const items = buildPaletteItems(false);

  it('returns everything for an empty or blank query', () => {
    expect(filterPaletteItems(items, '')).toHaveLength(items.length);
    expect(filterPaletteItems(items, '   ')).toHaveLength(items.length);
  });

  it('matches case-insensitively on the page name', () => {
    expect(filterPaletteItems(items, 'SHEET').map((i) => i.label)).toEqual(['DSA Sheet']);
  });

  it('matches on the group name, so typing Learn lists the learning pages', () => {
    expect(filterPaletteItems(items, 'learn').map((i) => i.label)).toEqual(['Notes', 'DSA Sheet', 'Prep Plan']);
  });

  it('requires every typed word to match', () => {
    expect(filterPaletteItems(items, 'dsa learn').map((i) => i.label)).toEqual(['DSA Sheet']);
    expect(filterPaletteItems(items, 'dsa zzz')).toEqual([]);
  });
});
