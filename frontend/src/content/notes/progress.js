/** A topic counts as read once this share of it has scrolled into view. */
export const READ_AT = 90;

/**
 * Totals for a track's written topics, from the saved reading progress in `items` (keyed by topic id).
 * `points` and `max` drive the track's progress bar.
 */
export function readingSummary(readyIds, items) {
  const progressOf = (id) => items[id]?.progress ?? 0;
  return {
    read: readyIds.filter((id) => progressOf(id) >= READ_AT).length,
    points: readyIds.reduce((sum, id) => sum + Math.min(100, progressOf(id)), 0),
    max: readyIds.length * 100,
  };
}
