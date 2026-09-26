import { useCallback, useEffect, useRef, useState } from 'react';
import { getTrackerItems, updateTrackerItem, deleteTrackerItem } from '../services/api';

/**
 * Loads and mutates per-user tracker items ({ done, important, note, log, startDate }) for one sheet.
 * Updates are optimistic and rolled back if the request fails.
 */
export default function useTracker(sheetId) {
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrackerItems(sheetId)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.error || 'Failed to load your progress.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sheetId]);

  const update = useCallback(async (itemKey, patch) => {
    const previous = itemsRef.current[itemKey];
    setItems((prev) => ({ ...prev, [itemKey]: { ...(prev[itemKey] || {}), ...patch } }));
    try {
      await updateTrackerItem(sheetId, itemKey, patch);
      setError(null);
    } catch (err) {
      setItems((prev) => {
        const next = { ...prev };
        if (previous) next[itemKey] = previous;
        else delete next[itemKey];
        return next;
      });
      const message = err?.response?.data?.error || 'Could not save. Please try again.';
      setError(message);
      throw new Error(message);
    }
  }, [sheetId]);

  const remove = useCallback(async (itemKey) => {
    const previous = itemsRef.current[itemKey];
    setItems((prev) => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
    try {
      await deleteTrackerItem(sheetId, itemKey);
    } catch (err) {
      if (previous) setItems((prev) => ({ ...prev, [itemKey]: previous }));
      setError(err?.response?.data?.error || 'Could not delete. Please try again.');
    }
  }, [sheetId]);

  return { items, loading, error, update, remove, clearError: () => setError(null) };
}
