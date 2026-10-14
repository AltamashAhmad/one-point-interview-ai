import React from 'react';
import { useAuth } from '../../contexts/useAuth';
import { Badge, ProgressBar } from '../ui';

/** Shows what the user has left: free-trial sessions, today's quota, or unlimited. */
export default function QuotaMeter() {
  const { isAdmin, isUnlimited, isPending, isApproved, trialUsed, trialLimit, dailyUsed, dailyLimit } = useAuth();

  if (isAdmin || isUnlimited) {
    return <div className="app-quota"><Badge tone="accent">Unlimited sessions</Badge></div>;
  }
  if (!isPending && !isApproved) return null;

  const used = isPending ? trialUsed : dailyUsed;
  const limit = isPending ? trialLimit : dailyLimit;
  const left = Math.max(0, limit - used);
  const tone = left === 0 ? 'danger' : left <= 1 ? 'warning' : 'accent';
  const title = isPending ? 'Free trial' : 'Sessions today';

  return (
    <div className="app-quota">
      <div className="app-quota__row">
        <span>{title}</span>
        <span className="app-quota__count">{used} / {limit}</span>
      </div>
      <ProgressBar value={used} max={limit} tone={tone} size="sm" ariaLabel={`${title}: ${used} of ${limit} used`} />
    </div>
  );
}
