import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '../components/PageHeader';
import TrackerNotice from '../components/TrackerNotice';
import { Button, EmptyState, Icon } from '../components/ui';
import useTracker from '../hooks/useTracker';
import { markdownComponents } from '../components/markdownComponents';
import { findTopic, getTrack } from '../content/notes/studyList';
import { hasTopicContent, loadTopicContent } from '../content/notes/content';
import { splitSections } from '../content/notes/sections';
import '../components/MessageBubble.css'; // shared .md-* markdown styles
import './Notes.css';

/** Percentage of the article that has scrolled into view (0 when it starts entering, 100 at its end). */
function useReadingProgress(ref, active) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;

    // Scroll events already arrive at most once per frame, so measuring directly needs no throttle.
    const measure = () => {
      const { top, height } = el.getBoundingClientRect();
      const seen = (window.innerHeight - top) / Math.max(height, 1);
      setProgress(Math.round(Math.min(1, Math.max(0, seen)) * 100));
    };

    const initial = setTimeout(measure, 0);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // Collapsing a section changes the article's height without any scroll event.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);

    return () => {
      clearTimeout(initial);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [ref, active]);

  return progress;
}

const Section = memo(function Section({ section, open, onToggle }) {
  return (
    <section id={section.id} className={`notes-section ${open ? 'is-open' : ''}`}>
      <h2 className="notes-section-title">
        <button
          type="button"
          className="notes-section-toggle"
          aria-expanded={open}
          aria-controls={`${section.id}-body`}
          onClick={() => onToggle(section.id)}
        >
          <span className="notes-section-caret" aria-hidden="true">▶</span>
          <span>{section.title}</span>
        </button>
      </h2>
      {/* Hidden rather than unmounted, so diagrams already drawn inside survive a collapse. */}
      <div id={`${section.id}-body`} className="notes-section-body" hidden={!open}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{section.body}</ReactMarkdown>
      </div>
    </section>
  );
});

function Article({ markdown, articleRef }) {
  const { intro, sections } = useMemo(() => splitSections(markdown), [markdown]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const jumpTo = (id) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const allCollapsed = collapsed.size === sections.length;

  return (
    <>
      {sections.length > 2 && (
        <nav className="notes-toc" aria-label="On this page">
          <span className="notes-toc-title">On this page</span>
          <ol>
            {sections.map((s) => (
              <li key={s.id}><button type="button" onClick={() => jumpTo(s.id)}>{s.title}</button></li>
            ))}
          </ol>
        </nav>
      )}

      {sections.length > 0 && (
        <div className="notes-toolbar">
          <span className="notes-toolbar-count">{sections.length} sections</span>
          <div className="notes-toolbar-actions">
            <Button variant="secondary" size="sm" onClick={() => setCollapsed(new Set())} disabled={collapsed.size === 0}>Expand all</Button>
            <Button variant="secondary" size="sm" onClick={() => setCollapsed(new Set(sections.map((s) => s.id)))} disabled={allCollapsed}>Collapse all</Button>
          </div>
        </div>
      )}

      <article className="notes-article" ref={articleRef}>
        {intro && (
          <div className="notes-lead">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{intro}</ReactMarkdown>
          </div>
        )}
        {sections.map((section) => (
          <Section key={section.id} section={section} open={!collapsed.has(section.id)} onToggle={toggle} />
        ))}
      </article>
    </>
  );
}

export default function NotesTopic() {
  const { topicId } = useParams();
  // Keyed by topic so reading progress and saving start fresh for each topic.
  return <TopicView key={topicId} />;
}

function TopicView() {
  const { trackId, topicId } = useParams();
  const navigate = useNavigate();
  const track = getTrack(trackId);
  const found = track ? findTopic(track, topicId) : null;
  const available = Boolean(found) && hasTopicContent(topicId);

  const [loaded, setLoaded] = useState({ topicId: null, markdown: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!available) return undefined;
    let cancelled = false;
    loadTopicContent(topicId)
      .then((markdown) => { if (!cancelled) setLoaded({ topicId, markdown, failed: false }); })
      .catch(() => { if (!cancelled) setLoaded({ topicId, markdown: null, failed: true }); });
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [available, topicId, attempt]);

  const markdown = loaded.topicId === topicId ? loaded.markdown : null;
  const failed = loaded.topicId === topicId && loaded.failed;
  const retry = () => {
    setLoaded({ topicId: null, markdown: null, failed: false });
    setAttempt((a) => a + 1);
  };
  const articleRef = useRef(null);
  const progress = useReadingProgress(articleRef, Boolean(markdown));
  const tracker = useTracker('study-notes');
  const { update } = tracker;
  const saved = tracker.items[topicId]?.progress ?? 0;
  const shown = Math.max(saved, progress);
  const savedRef = useRef(saved);
  const progressRef = useRef(progress);

  useEffect(() => {
    savedRef.current = saved;
    progressRef.current = progress;
  }, [saved, progress]);

  // Saves only a further point than before, once scrolling settles.
  useEffect(() => {
    if (!markdown || progress <= savedRef.current) return undefined;
    const timer = setTimeout(() => update(topicId, { progress }).catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [markdown, progress, topicId, update]);

  // Leaving the topic saves the furthest point reached, even before the debounce fires.
  useEffect(() => () => {
    if (progressRef.current > savedRef.current) update(topicId, { progress: progressRef.current }).catch(() => {});
  }, [topicId, update]);

  if (!track) return <Navigate to="/notes" replace />;
  if (!found) return <Navigate to={`/notes/${trackId}`} replace />;

  const { topic, group, number, total, previous, next } = found;
  const goTo = (t) => navigate(`/notes/${track.id}/${t.id}`);

  return (
    <div className="page-shell">
      <PageHeader
        icon={<Icon name={track.icon} size={20} />}
        title={topic.title}
        subtitle={`${group.title} · Topic ${number} of ${total}`}
        backTo={`/notes/${track.id}`}
        backLabel={track.title}
        actions={markdown ? <span className="notes-progress-pill" title="How much of this topic you have read">{shown}%</span> : null}
      />
      <div className="notes-page notes-page--article" style={{ '--track-accent': track.accent }}>
        {markdown && (
          <div
            className="notes-progress"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={shown}
          >
            <div className="notes-progress-fill" style={{ width: `${shown}%` }} />
          </div>
        )}
        <TrackerNotice tracker={tracker} />
        {!available && (
          <div className="notes-soon">
            <span className="notes-soon-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
            <h2>Coming soon</h2>
            <p>{topic.summary}</p>
          </div>
        )}
        {available && !markdown && !failed && <p className="notes-loading">Loading notes…</p>}
        {available && failed && (
          <EmptyState
            icon="alert"
            title="Could not load these notes"
            description="Check your connection, then try again."
            action={<Button variant="secondary" onClick={retry}>Try again</Button>}
          />
        )}
        {markdown && <Article key={topicId} markdown={markdown} articleRef={articleRef} />}
        <nav className="notes-pager" aria-label="Topic navigation">
          {previous
            ? <button type="button" className="notes-pager-btn" onClick={() => goTo(previous)}><span>← Previous</span><strong>{previous.title}</strong></button>
            : <span />}
          {next
            ? <button type="button" className="notes-pager-btn is-next" onClick={() => goTo(next)}><span>Next →</span><strong>{next.title}</strong></button>
            : <span />}
        </nav>
      </div>
    </div>
  );
}
