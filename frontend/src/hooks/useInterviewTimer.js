import { useState, useEffect, useRef, useMemo } from 'react';

export function useInterviewTimer(sessionId, isActive, interviewType) {
  const timerDuration = useMemo(() => {
    switch(interviewType) {
      case 'dsa': return 45 * 60; // 45 minutes
      case 'lld': return 60 * 60; // 60 minutes
      case 'systemDesign': return 60 * 60; // 60 minutes
      default: return 45 * 60;
    }
  }, [interviewType]);

  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !isActive) {
      clearInterval(intervalRef.current);
      return;
    }

    const storageKey = `interview_timer_${sessionId}`;
    const stored = localStorage.getItem(storageKey);

    let endTime;
    if (stored) {
      endTime = parseInt(stored, 10);
    } else {
      endTime = Date.now() + timerDuration * 1000;
      localStorage.setItem(storageKey, endTime.toString());
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(intervalRef.current);
      }
    };

    // Update immediately and then every second
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalRef.current);
  }, [sessionId, isActive, timerDuration]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isUrgent = timeLeft > 0 && timeLeft <= 5 * 60; // Less than 5 mins
  const isExpired = timeLeft === 0;

  return { timeLeft, formattedTime, isUrgent, isExpired };
}
