import { useCallback } from 'react';

const STORAGE_KEY = 'interview_loops';

/**
 * Hook to manage interview loops in localStorage.
 */
export function useLoopPersist() {
  const getLoops = useCallback(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to parse interview_loops from localStorage:', err);
      return [];
    }
  }, []);

  const getLoop = useCallback((loopId) => {
    const loops = getLoops();
    return loops.find((l) => l.id === loopId) || null;
  }, [getLoops]);

  const createLoop = useCallback((company, level, loopsArray) => {
    const loops = getLoops();
    const newLoop = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
      company,
      level,
      status: 'in-progress',
      currentRoundIndex: 0,
      rounds: loopsArray.map(round => ({
        type: round.type,
        name: round.name,
        status: 'pending',
        score: null,
        sessionId: null
      }))
    };
    
    loops.push(newLoop);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loops));
    return newLoop;
  }, [getLoops]);

  const updateLoopRound = useCallback((loopId, roundIndex, status, score, sessionId) => {
    const loops = getLoops();
    const loopIndex = loops.findIndex(l => l.id === loopId);
    
    if (loopIndex !== -1) {
      const loop = loops[loopIndex];
      if (loop.rounds[roundIndex]) {
        if (status !== undefined) loop.rounds[roundIndex].status = status;
        if (score !== undefined) loop.rounds[roundIndex].score = score;
        if (sessionId !== undefined) loop.rounds[roundIndex].sessionId = sessionId;
        
        // Progression Logic
        if (status === 'failed') {
          loop.status = 'failed';
        } else if (status === 'passed') {
          if (roundIndex === loop.rounds.length - 1) {
            loop.status = 'passed';
          } else if (loop.currentRoundIndex === roundIndex) {
            loop.currentRoundIndex = roundIndex + 1;
            if (loop.rounds[roundIndex + 1].status === 'locked' || loop.rounds[roundIndex + 1].status === 'pending') {
              loop.rounds[roundIndex + 1].status = 'pending';
            }
          }
        }
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loops));
      return loop;
    }
    return null;
  }, [getLoops]);

  return {
    getLoops,
    getLoop,
    createLoop,
    updateLoopRound
  };
}
