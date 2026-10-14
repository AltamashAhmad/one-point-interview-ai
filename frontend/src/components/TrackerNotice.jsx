import React from 'react';
import { Button } from './ui';
import './TrackerNotice.css';

/** Shows a tracker error and, when the initial load failed, a way to try again. */
export default function TrackerNotice({ tracker }) {
  if (!tracker.error) return null;

  return (
    <div className="tracker-notice" role="alert">
      <span>{tracker.error}</span>
      {tracker.loadFailed && <Button variant="secondary" size="xs" onClick={tracker.reload}>Try again</Button>}
    </div>
  );
}
