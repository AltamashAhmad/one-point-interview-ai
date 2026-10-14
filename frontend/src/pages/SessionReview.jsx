import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, generateSessionNotes, updateSession } from '../services/api';
import { describeError } from '../utils/errors';
import { TYPE_CONFIG, formatDate, friendlyModelName } from '../utils/constants';
import { findModel } from '../services/modelCatalog';
import MessageBubble from '../components/MessageBubble';
import PageHeader from '../components/PageHeader';
import { Button, EmptyState, Icon, Tabs, Textarea } from '../components/ui';
import './SessionReview.css';

const TABS = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'notes', label: 'My notes' },
];

export default function SessionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');

  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);

  const fetchInterview = useCallback(async () => {
    try {
      const data = await getSession(id);
      setInterview(data);
      if (data.notes) setNotesContent(data.notes);
    } catch {
      setError('Failed to load this interview session.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInterview(); }, [fetchInterview]);

  const retryLoad = () => {
    setError(null);
    setLoading(true);
    fetchInterview();
  };

  const handleCopy = () => {
    if (!interview?.messages) return;
    const text = interview.messages
      .map((m) => `[${m.role === 'user' ? 'You' : 'Interviewer'}]\n${m.content}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerateNotes = async () => {
    setGeneratingNotes(true);
    setNotesError(null);
    try {
      const generated = await generateSessionNotes(id);
      setNotesContent(generated);
      setInterview((prev) => ({ ...prev, notes: generated }));
    } catch (err) {
      setNotesError(`Failed to generate notes: ${describeError(err)}`);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesError(null);
    try {
      await updateSession(id, { notes: notesContent });
      setInterview((prev) => ({ ...prev, notes: notesContent }));
      setIsEditingNotes(false);
    } catch (err) {
      setNotesError(`Failed to save notes: ${describeError(err)}`);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="session-state">
        <div className="spinner" />
        <p>Loading session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-state">
        <EmptyState
          icon="alert"
          title="Couldn't open this session"
          description={error}
          action={(
            <>
              <Button onClick={retryLoad}>Try again</Button>
              <Button variant="secondary" onClick={() => navigate('/history')}>Back to history</Button>
            </>
          )}
        />
      </div>
    );
  }

  if (!interview) return null;

  const config = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, color: '#64748b', icon: 'book' };
  const date = formatDate(interview.startedAt || interview.updatedAt);
  const cfg = interview.config || {};
  const question = interview.question;
  const metaItems = [
    cfg.company && { label: 'Company', value: cfg.company },
    cfg.difficulty && cfg.difficulty !== 'ANY' && { label: 'Difficulty', value: cfg.difficulty },
    cfg.language && { label: 'Language', value: cfg.language },
    { label: 'Model', value: findModel(cfg.model)?.name || friendlyModelName(cfg.model) },
    { label: 'Messages', value: interview.messages?.length || 0 },
    date && { label: 'Date', value: date },
  ].filter(Boolean);

  return (
    <div className="session-review">
      <div className="session-review__head">
        <PageHeader
          icon={<Icon name={config.icon} size={20} />}
          title={question?.title || `${config.label} ${config.isTutor ? 'Session' : 'Interview'}`}
          subtitle={`${config.label} ${config.isTutor ? 'session' : 'interview'}${date ? ` · ${date}` : ''}`}
          backTo="/history"
          backLabel="History"
          actions={(
            <>
              {question?.link && (
                <Button as="a" variant="ghost" size="sm" href={question.link} target="_blank" rel="noopener noreferrer" iconRight="external">LeetCode</Button>
              )}
              <Button variant="secondary" size="sm" icon="copy" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</Button>
              {interview.status === 'active' && (
                <Button size="sm" iconRight="arrowRight" onClick={() => navigate(`/interview/${interview.interviewType}?session=${id}`)}>Continue</Button>
              )}
              {interview.scorecard && (
                <Button size="sm" onClick={() => navigate(`/scorecard/${id}`)}>View scorecard</Button>
              )}
            </>
          )}
        />
        <div className="session-meta" role="list" aria-label="Session details">
          {metaItems.map((item) => (
            <div key={item.label} className="session-meta__item" role="listitem">
              <span className="session-meta__label">{item.label}</span>
              <span className="session-meta__value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="session-body">
        <Tabs ariaLabel="Session view" items={TABS} value={activeTab} onChange={setActiveTab} />

        {activeTab === 'transcript' ? (
          <section className="transcript" aria-label="Transcript">
            <p className="session-banner">
              <Icon name="book" size={16} />
              {interview.status === 'active' ? 'This session is still in progress. Use Continue to keep going.' : 'Read-only session review.'}
            </p>
            {interview.messages?.map((msg, i) => (
              <MessageBubble key={i} message={msg} typeColor={config.color} />
            ))}
          </section>
        ) : (
          <section className="session-notes" aria-label="My notes">
            {notesError && <p className="session-notice" role="alert"><Icon name="alert" size={16} />{notesError}</p>}
            {!interview.notes && !generatingNotes ? (
              <EmptyState
                icon="sparkles"
                title="No notes yet"
                description="Let AI analyze this interview and write revision notes: intuition, brute force, optimization path and optimal code."
                action={<Button icon="sparkles" onClick={handleGenerateNotes}>Generate AI notes</Button>}
              />
            ) : generatingNotes ? (
              <div className="session-state">
                <div className="spinner" />
                <p>Analyzing the transcript and writing notes…</p>
              </div>
            ) : isEditingNotes ? (
              <div className="notes-editor">
                <div className="notes-editor__actions">
                  <Button variant="ghost" disabled={savingNotes} onClick={() => { setIsEditingNotes(false); setNotesContent(interview.notes); }}>Cancel</Button>
                  <Button loading={savingNotes} onClick={handleSaveNotes}>Save notes</Button>
                </div>
                <Textarea
                  className="notes-editor__text"
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Type your notes here in Markdown…"
                  aria-label="Notes in Markdown"
                />
              </div>
            ) : (
              <div className="notes-view">
                <div className="notes-view__actions">
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setIsEditingNotes(true)}>Edit notes</Button>
                </div>
                <MessageBubble message={{ role: 'assistant', content: notesContent }} typeColor={config.color} />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
