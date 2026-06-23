import { useCallback, useRef } from 'react';

const PREFIX = 'opi_session_'; // one-point-interview

/**
 * Persist and restore an interview session to/from localStorage.
 * Key is scoped per interview type so DSA / LLD / SD don't clash.
 *
 * Stored shape:
 * {
 *   setupPhase:    boolean,
 *   sessionConfig: object | null,
 *   messages:      array,
 *   sessionId:     string | null,
 *   questionMeta:  object | null,
 *   selectedModel: string | null,
 *   scorecardModel: string | null,
 * }
 */
export function useSessionPersist(identifier) {
  const key = PREFIX + (identifier || 'unknown');
  const cachedRestore = useRef(undefined); // undefined = not yet read
  const lastKey = useRef(key);

  if (lastKey.current !== key) {
    cachedRestore.current = undefined;
    lastKey.current = key;
  }

  /** Save current state to localStorage */
  const persist = useCallback((state) => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      cachedRestore.current = undefined; // invalidate cache on write
    } catch (_) {
      // Storage full or private mode — silently skip
    }
  }, [key]);

  /**
   * Load saved state. Returns null if nothing saved.
   * Memoized per render cycle so multiple lazy initializers
   * calling restore() don't redundantly parse JSON.
   */
  const restore = useCallback(() => {
    if (cachedRestore.current !== undefined) return cachedRestore.current;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        cachedRestore.current = null;
        return null;
      }
      cachedRestore.current = JSON.parse(raw);
      return cachedRestore.current;
    } catch (_) {
      cachedRestore.current = null;
      return null;
    }
  }, [key]);

  /** Wipe the saved session (called on "New Session") */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      cachedRestore.current = undefined;
    } catch (_) {}
  }, [key]);

  return { persist, restore, clear };
}
