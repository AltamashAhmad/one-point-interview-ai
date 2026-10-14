import { useEffect, useState } from 'react';

/**
 * Counts down to a server-provided deadline (ISO string).
 * `offsetMs` = serverNow - clientNow, so a wrong device clock doesn't end the interview early or late.
 */
export function useCountdown(endsAt, offsetMs = 0) {
  const deadline = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [deadline]);

  if (!deadline) return { formattedTime: null, secondsLeft: null, isUrgent: false, isExpired: false };

  const secondsLeft = Math.max(0, Math.floor((deadline - (now + offsetMs)) / 1000));
  return {
    formattedTime: formatClock(secondsLeft),
    secondsLeft,
    isUrgent: secondsLeft > 0 && secondsLeft <= 5 * 60,
    isExpired: secondsLeft === 0,
  };
}

export function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
