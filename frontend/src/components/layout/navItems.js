/** Single source of truth for navigation, shared by the desktop sidebar and the mobile tab bar. */

export const NAV_GROUPS = [
  {
    id: 'main',
    items: [{ to: '/', label: 'Home', icon: 'home', end: true }],
  },
  {
    id: 'practice',
    label: 'Practice',
    items: [
      { to: '/interview/dsa', label: 'DSA', icon: 'code' },
      { to: '/interview/systemDesign', label: 'System Design', icon: 'layers' },
      { to: '/interview/lld', label: 'Low-Level Design', icon: 'box' },
      { to: '/interview/managerial', label: 'Behavioral', icon: 'message' },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    items: [
      { to: '/notes', label: 'Notes', icon: 'book' },
      { to: '/dsa-sheet', label: 'DSA Sheet', icon: 'checklist' },
      { to: '/prep-plan', label: 'Prep Plan', icon: 'calendar' },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    items: [{ to: '/history', label: 'History', icon: 'history' }],
  },
];

export const ADMIN_ITEMS = [
  { to: '/admin', label: 'Admin panel', icon: 'shield' },
  { to: '/admin/prompts', label: 'Prompt generator', icon: 'sparkles' },
];

/** The four destinations that get a slot in the phone tab bar; everything else lives behind "More". */
export const TAB_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/notes', label: 'Notes', icon: 'book' },
  { to: '/dsa-sheet', label: 'Sheet', icon: 'checklist' },
  { to: '/history', label: 'History', icon: 'history' },
];
