import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import TrackerNotice from '../components/TrackerNotice';
import { getTrack, trackTopics } from '../content/notes/studyList';
import { hasTopicContent } from '../content/notes/content';
import { READ_AT, readingSummary } from '../content/notes/progress';
import useTracker from '../hooks/useTracker';
import { Icon, ProgressBar } from '../components/ui';
import './Notes.css';
import './NotesTrack.css';

export default function NotesTrack() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const tracker = useTracker('study-notes');
  const track = getTrack(trackId);
  if (!track) return <Navigate to="/notes" replace />;

  const topics = trackTopics(track);
  const readyIds = topics.filter((t) => hasTopicContent(t.id)).map((t) => t.id);
  const ready = readyIds.length;
  const { read, points, max } = readingSummary(readyIds, tracker.items);
  let number = 0;

  return (
    <div className="page-shell">
      <PageHeader
        icon={<Icon name={track.icon} size={20} />}
        title={track.title}
        subtitle={`${read} of ${ready} read · ${topics.length} topics`}
        backTo="/notes"
        backLabel="Notes"
      />
      <div className="notes-page" style={{ '--track-accent': track.accent }}>
        <p className="notes-intro">{track.tagline}</p>
        <TrackerNotice tracker={tracker} />
        <ProgressBar value={points} max={Math.max(max, 1)} ariaLabel="Reading progress" className="notes-track-progress" />
        {track.groups.map((group) => (
          <section key={group.id} className="notes-group">
            <h2 className="notes-group-title">{group.title}</h2>
            <ol className="notes-topic-list">
              {group.topics.map((topic) => {
                number += 1;
                const available = hasTopicContent(topic.id);
                const saved = tracker.items[topic.id]?.progress ?? 0;
                const status = !available ? 'Coming soon' : saved >= READ_AT ? 'Read' : saved > 0 ? `${saved}% read` : 'Start →';
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className={`notes-topic-row ${available ? '' : 'is-soon'}`}
                      disabled={!available}
                      onClick={() => navigate(`/notes/${track.id}/${topic.id}`)}
                    >
                      <span className="notes-topic-num">{number}</span>
                      <span className="notes-topic-text">
                        <span className="notes-topic-title">{topic.title}</span>
                        <span className="notes-topic-summary">{topic.summary}</span>
                      </span>
                      <span className={`notes-topic-status ${available ? 'is-ready' : ''} ${saved >= READ_AT ? 'is-read' : ''}`}>
                        {status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
