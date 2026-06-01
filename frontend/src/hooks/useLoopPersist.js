import { useCallback } from 'react';
import * as api from '../services/api';

const LEGACY_STORAGE_KEY = 'interview_loops';
const MIGRATED_FLAG_KEY = 'loops_migrated_to_account';

/**
 * Hook to manage interview loops. Loops are stored in the user's account
 * (Firestore via the backend API) so they persist across devices.
 *
 * A one-time migration uploads any loops left in localStorage from the old
 * device-only implementation, then clears the legacy key.
 */
export function useLoopPersist() {
  const getLoops = useCallback(() => api.getLoops(), []);

  const getLoop = useCallback((loopId) => api.getLoop(loopId), []);

  const createLoop = useCallback((company, level, roundsArray) => {
    const rounds = roundsArray.map((round) => ({
      type: round.type,
      name: round.name,
      status: 'pending',
      score: null,
      sessionId: null,
    }));
    return api.createLoop({ company, level, rounds });
  }, []);

  const updateLoopRound = useCallback((loopId, roundIndex, status, score, sessionId) => {
    const payload = { roundIndex };
    if (status !== undefined) payload.status = status;
    if (score !== undefined) payload.score = score;
    if (sessionId !== undefined) payload.sessionId = sessionId;
    return api.updateLoopRound(loopId, payload);
  }, []);

  const deleteLoop = useCallback((loopId) => api.deleteLoop(loopId), []);

  /**
   * One-time migration of localStorage loops into the user's account.
   * Safe to call on every mount — it no-ops once the flag is set.
   */
  const migrateLocalLoops = useCallback(async () => {
    if (localStorage.getItem(MIGRATED_FLAG_KEY)) return;

    let localLoops = [];
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      localLoops = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to parse legacy interview_loops:', err);
      localLoops = [];
    }

    if (!Array.isArray(localLoops) || localLoops.length === 0) {
      localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      return;
    }

    try {
      for (const loop of localLoops) {
        await api.createLoop({
          company: loop.company,
          level: loop.level,
          rounds: loop.rounds,
          status: loop.status,
          currentRoundIndex: loop.currentRoundIndex,
        });
      }
      localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      // Leave the legacy data in place so migration can retry next time.
      console.error('Loop migration failed, will retry later:', err);
    }
  }, []);

  return {
    getLoops,
    getLoop,
    createLoop,
    updateLoopRound,
    deleteLoop,
    migrateLocalLoops,
  };
}
