import React, { useState } from 'react';
import { Button, Card, Icon, IconButton } from './ui';
import './GettingStarted.css';

const STEPS = [
  { icon: 'code', title: 'Run a mock interview', text: 'A timed DSA round with an AI interviewer and a scorecard at the end.', action: 'Start DSA round', to: '/interview/dsa' },
  { icon: 'graduation', title: 'Try tutor mode', text: 'Learn a topic step by step with no timer and nothing scored.', action: 'Start learning', to: '/interview/tutorDsa' },
  { icon: 'checklist', title: 'Open the DSA sheet', text: 'Pick problems by pattern and track what you have solved.', action: 'Open sheet', to: '/dsa-sheet' },
];

const storageKey = (userId) => `opi_getting_started_dismissed_${userId}`;

function wasDismissed(userId) {
  try { return localStorage.getItem(storageKey(userId)) === '1'; } catch { return false; }
}

/** First-run checklist for accounts with no sessions; dismissal is remembered per account in this browser. */
export default function GettingStarted({ userId, onGo }) {
  const [dismissed, setDismissed] = useState(() => wasDismissed(userId));

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey(userId), '1'); } catch { /* private mode: hide for this visit only */ }
    setDismissed(true);
  };

  return (
    <Card
      as="section"
      className="getting-started"
      aria-labelledby="getting-started-title"
      titleAs="h2"
      title={<span id="getting-started-title">Get started in three steps</span>}
      description="You have not run an interview yet. Pick any step to begin."
      actions={<IconButton icon="x" label="Dismiss getting started" size="sm" onClick={dismiss} />}
    >
      <ol className="getting-started__steps">
        {STEPS.map((step, index) => (
          <li key={step.to} className="getting-started__step">
            <span className="getting-started__number" aria-hidden="true">{index + 1}</span>
            <span className="getting-started__icon" aria-hidden="true"><Icon name={step.icon} size={18} /></span>
            <h3 className="getting-started__title">{step.title}</h3>
            <p className="getting-started__text">{step.text}</p>
            <Button variant="secondary" size="sm" iconRight="arrowRight" onClick={() => onGo(step.to)}>{step.action}</Button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
