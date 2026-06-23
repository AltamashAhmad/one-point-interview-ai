import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getHistory, deleteSession, pinSession } from '../services/api';
import { TYPE_CONFIG, formatDate, friendlyModelName, modelProviderColor } from '../utils/constants';
import ThemeToggle from '../components/ThemeToggle';
import './History.css';

// Define the display order and group labels for each interview type
const GROUP_ORDER = [
  { key: 'pinned',        label: '📌 Pinned',             types: null },
  { key: 'dsa',          label: '🧩 DSA Mock Interviews',  types: ['dsa'] },
  { key: 'tutorDsa',     label: '🎓 DSA Tutor Sessions',   types: ['tutorDsa'] },
  { key: 'systemDesign', label: '🏗️ System Design',        types: ['systemDesign'] },
  { key: 'lld',          label: '🔧 Low-Level Design',     types: ['lld'] },
  { key: 'tutorLld',     label: '🎓 LLD Tutor Sessions',   types: ['tutorLld'] },
  { key: 'managerial',   label: '👔 Managerial',           types: ['managerial'] },
  { key: 'other',        label: '📄 Other',                types: null },
];

export default function History() {
  const [interviews,     setInterviews]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [pinningId,      setPinningId]      = useState(null);
  const [pinError,       setPinError]       = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set(['pinned'])); // pinned open by default
  const [searchParams]                      = useSearchParams();
  const navigate = useNavigate();

  const questionFilter = searchParams.get('question');

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getHistory();
      setInterviews(data);
    } catch (err) {
      setError('Failed to load interview history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmDelete = (e, interview) => {
    e.stopPropagation();
    setDeleteTarget(interview);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSession(deleteTarget.id);
      setInterviews(prev => prev.filter(i => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert('Failed to delete session');
    } finally {
      setDeleting(false);
    }
  };

  const handlePin = async (e, interview) => {
    e.stopPropagation();
    setPinError(null);
    setPinningId(interview.id);
    try {
      const result = await pinSession(interview.id);
      setInterviews(prev =>
        prev.map(i => i.id === interview.id ? { ...i, isPinned: result.isPinned } : i)
      );
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to update pin.';
      setPinError(msg);
      setTimeout(() => setPinError(null), 4000);
    } finally {
      setPinningId(null);
    }
  };

  // Apply optional question filter from URL params
  const visibleInterviews = questionFilter
    ? interviews.filter(i => i.questionTitle === questionFilter)
    : interviews;

  // Build grouped list
  const buildGroups = (list) => {
    const pinned = list.filter(i => i.isPinned);
    const groups = [];

    if (pinned.length > 0) {
      groups.push({ key: 'pinned', label: '📌 Pinned', items: pinned });
    }

    for (const grp of GROUP_ORDER) {
      if (grp.key === 'pinned') continue;
      if (grp.types) {
        const items = list.filter(i => grp.types.includes(i.interviewType));
        if (items.length > 0) groups.push({ ...grp, items });
      } else if (grp.key === 'other') {
        const knownTypes = GROUP_ORDER.flatMap(g => g.types || []);
        const items = list.filter(i => !knownTypes.includes(i.interviewType));
        if (items.length > 0) groups.push({ ...grp, items });
      }
    }
    return groups;
  };

  const groups = buildGroups(visibleInterviews);

  const renderCard = (interview) => {
    const meta   = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, emoji: '📄', color: '#64748b' };
    const mName  = friendlyModelName(interview.modelUsed);
    const mColor = modelProviderColor(interview.modelUsed);
    const isPinning = pinningId === interview.id;

    return (
      <div
        key={interview.id}
        className={`history-card ${interview.isPinned ? 'history-card--pinned' : ''}`}
        onClick={() => {
          if (!interview.scorecard) {
            navigate(`/interview/${interview.interviewType}?session=${interview.id}`);
          } else {
            navigate(`/history/${interview.id}`);
          }
        }}
      >
        {/* Card top row */}
        <div className="history-card-header">
          <div className="hcard-left">
            <span className="hcard-emoji">{meta.emoji}</span>
            <div>
              <span className="type-badge" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                {meta.label}
              </span>
              {interview.questionTitle && (
                <div className="hcard-question">{interview.questionTitle}</div>
              )}
            </div>
          </div>
          <div className="hcard-right">
            <span className="history-date">{formatDate(interview.startedAt || interview.updatedAt)}</span>
            {interview.scorecard ? (
              <span className="scorecard-badge">📊 Scorecard</span>
            ) : (
              <span className="scorecard-badge" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                ⏳ Incomplete (Resume)
              </span>
            )}
            {interview.notes && (
              <span className="notes-badge">📝 Notes</span>
            )}
          </div>
        </div>

        {/* Card metadata row */}
        <div className="history-card-body">
          {interview.company && (
            <div className="history-stat">
              <span className="stat-label">Company</span>
              <span className="stat-value">🏢 {interview.company}</span>
            </div>
          )}
          {interview.difficulty && interview.difficulty !== 'ANY' && (
            <div className="history-stat">
              <span className="stat-label">Difficulty</span>
              <span className="stat-value">{interview.difficulty}</span>
            </div>
          )}
          {interview.language && (
            <div className="history-stat">
              <span className="stat-label">Language</span>
              <span className="stat-value">💻 {interview.language}</span>
            </div>
          )}
          <div className="history-stat">
            <span className="stat-label">Messages</span>
            <span className="stat-value">{interview.messages?.length || 0}</span>
          </div>
          <div className="history-stat">
            <span className="stat-label">Model</span>
            <span className="stat-value model-value" style={{ color: mColor }}>{mName}</span>
          </div>
        </div>

        {/* Card footer actions: pin + delete */}
        <div className="history-card-footer">
          <button
            className={`history-pin-btn ${interview.isPinned ? 'history-pin-btn--active' : ''}`}
            onClick={(e) => handlePin(e, interview)}
            disabled={isPinning}
            title={interview.isPinned ? 'Unpin this session' : 'Pin this session (max 3)'}
          >
            {isPinning ? '…' : interview.isPinned ? '⭐ Pinned' : '☆ Pin'}
          </button>

          <button
            className="history-delete-btn"
            onClick={(e) => confirmDelete(e, interview)}
            aria-label="Delete interview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div style={{ flex: 1 }}>
          <h1>Interview History</h1>
          {questionFilter && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Showing sessions for: <strong style={{ color: 'var(--text-primary)' }}>{questionFilter}</strong>
              <button
                onClick={() => navigate('/history')}
                style={{ marginLeft: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >✕ Clear filter</button>
            </div>
          )}
        </div>
        <ThemeToggle />
      </header>

      {pinError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 24px', fontSize: '14px', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {pinError}
        </div>
      )}

      <main className="history-main">
        {loading ? (
          <div className="history-list">
            {[1,2,3].map(i => (
              <div key={i} className="history-card history-card--skeleton">
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-line--med" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="history-error">{error}</div>
        ) : visibleInterviews.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">{questionFilter ? '🔍' : '📝'}</div>
            <h2>{questionFilter ? `No sessions for "${questionFilter}"` : 'No interviews yet'}</h2>
            <p>{questionFilter ? "You haven't practiced this question yet." : 'Start a new interview session to see your history here.'}</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate(questionFilter ? '/roadmap' : '/')}>
              {questionFilter ? 'Back to Roadmap' : 'Go to Home'}
            </button>
          </div>
        ) : (
          <div className="history-grouped">
            {groups.map(group => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <section key={group.key} className="history-group">
                  {/* Clickable accordion header — same style as Roadmap topic headers */}
                  <h2
                    className="history-group-label"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="history-group-chevron" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      ▶
                    </span>
                    <span>{group.label}</span>
                    <span className="history-group-count">{group.items.length}</span>
                  </h2>

                  {isExpanded && (
                    <div className="history-list">
                      {group.items.map(renderCard)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h3 className="modal-title">Delete this session?</h3>
            <p className="modal-body">
              {deleteTarget.questionTitle
                ? <><strong>{deleteTarget.questionTitle}</strong> — this can't be undone.</>
                : 'This interview session will be permanently deleted.'}
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="modal-btn modal-btn--delete" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
