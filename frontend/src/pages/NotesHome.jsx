import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import TrackerNotice from '../components/TrackerNotice';
import { Icon } from '../components/ui';
import { NOTES_TRACKS, trackTopics } from '../content/notes/studyList';
import { hasTopicContent } from '../content/notes/content';
import { readingSummary } from '../content/notes/progress';
import useTracker from '../hooks/useTracker';
import './Notes.css';

export default function NotesHome() {
  const navigate = useNavigate();
  const tracker = useTracker('study-notes');

  return (
    <div className="page-shell">
      <PageHeader icon={<Icon name="book" size={20} />} title="Notes" subtitle="Learn every topic from first principles" />
      <div className="notes-page">
        <p className="notes-intro">
          Each topic explains how it works inside the computer, every operation and its cost, when to use it, and
          practice problems. Work through them in order.
        </p>
        <TrackerNotice tracker={tracker} />
        <section className="notes-track-grid" aria-label="Note collections">
          {NOTES_TRACKS.map((track) => {
            const topics = trackTopics(track);
            const readyIds = topics.filter((t) => hasTopicContent(t.id)).map((t) => t.id);
            const ready = readyIds.length;
            const { read } = readingSummary(readyIds, tracker.items);
            return (
              <button
                key={track.id}
                type="button"
                className="notes-track-card"
                style={{ '--track-accent': track.accent }}
                onClick={() => navigate(`/notes/${track.id}`)}
              >
                <span className="notes-track-icon" aria-hidden="true"><Icon name={track.icon} size={22} /></span>
                <span className="notes-track-title">{track.title}</span>
                <span className="notes-track-desc">{track.tagline}</span>
                <span className="notes-track-meta">
                  <span>{topics.length} topics</span>
                  <span>{read} of {ready} read</span>
                </span>
                <span className="notes-track-cta">Open <span aria-hidden="true">→</span></span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
