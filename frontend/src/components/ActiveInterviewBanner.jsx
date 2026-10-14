import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions } from '../services/api';
import { useCountdown } from '../hooks/useCountdown';
import { TYPE_CONFIG } from '../utils/constants';
import { Button, Icon } from './ui';
import './ActiveInterviewBanner.css';

/** "Interview in progress" call-out, so a running clock is never forgotten (e.g. after switching device). */
export default function ActiveInterviewBanner() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listSessions({ status: 'active' })
      .then((sessions) => {
        if (cancelled) return;
        // Timed out with no answers has nothing to resume or score.
        const deadOnArrival = (s) => Date.parse(s.timerEndsAt) <= Date.parse(s.serverNow) && !s.userMessageCount;
        setRunning(sessions.find((s) => !s.legacy && s.timerEndsAt && s.messageCount > 0 && !deadOnArrival(s)) || null);
      })
      .catch((err) => console.warn('Could not check for a running interview:', err));
    return () => { cancelled = true; };
  }, []);

  const offset = useMemo(() => (running?.serverNow ? Date.parse(running.serverNow) - Date.now() : 0), [running]);
  const { formattedTime, isExpired } = useCountdown(running?.timerEndsAt || null, offset);
  if (!running) return null;

  const type = TYPE_CONFIG[running.interviewType];
  const open = () => navigate(`/interview/${running.interviewType}?session=${running.id}`);

  return (
    <div
      className="resume-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
    >
      <div>
        <h2 className="resume-card__title">
          <Icon name="clock" size={18} />
          {isExpired ? "Time's up on your interview" : 'Interview in progress'}
        </h2>
        <p className="resume-card__text">
          {type?.label || running.interviewType}
          {running.question?.title ? ` — ${running.question.title}` : ''}
          {' · '}
          {isExpired ? 'open it to get your scorecard' : `${formattedTime} left (the clock keeps running)`}
        </p>
      </div>
      <Button tabIndex={-1} iconRight="arrowRight">
        {isExpired ? 'Get scorecard' : 'Resume'}
      </Button>
    </div>
  );
}
