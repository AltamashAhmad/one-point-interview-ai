import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory, deleteSession } from '../services/api';
<<<<<<< HEAD
import './History.css';

export default function History() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);
=======
import { TYPE_CONFIG, formatDate, friendlyModelName, modelProviderColor } from '../utils/constants';
import './History.css';

export default function History() {
  const [interviews,    setInterviews]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null); // Bug #6 fix: styled modal
  const [deleting,      setDeleting]      = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchHistory(); }, []);
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)

  const fetchHistory = async () => {
    try {
      const data = await getHistory();
      setInterviews(data);
    } catch (err) {
      setError('Failed to load interview history.');
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this interview session?')) return;
    try {
      await deleteSession(id);
      setInterviews(interviews.filter(i => i.id !== id));
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp._seconds ? timestamp._seconds * 1000 : timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeLabel = (type) => {
    const types = {
      dsa: 'DSA',
      systemDesign: 'System Design',
      lld: 'LLD'
    };
    return types[type] || type;
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>Interview History</h1>
        <div className="header-placeholder"></div>
=======
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

  return (
    <div className="history-page">
      <header className="history-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Interview History</h1>
        <div className="header-placeholder" />
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
      </header>

      <main className="history-main">
        {loading ? (
<<<<<<< HEAD
          <div className="history-loading">Loading past interviews...</div>
=======
          /* Loading skeleton */
          <div className="history-list">
            {[1,2,3].map(i => (
              <div key={i} className="history-card history-card--skeleton">
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-line--med" />
              </div>
            ))}
          </div>
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
        ) : error ? (
          <div className="history-error">{error}</div>
        ) : interviews.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">📝</div>
            <h2>No interviews yet</h2>
            <p>Start a new interview session to see your history here.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Go to Home</button>
          </div>
        ) : (
          <div className="history-list">
<<<<<<< HEAD
            {interviews.map((interview) => (
              <div 
                key={interview.id} 
                className="history-card"
                onClick={() => navigate(`/history/${interview.id}`)}
              >
                <div className="history-card-header">
                  <span className={`type-badge type-${interview.interviewType}`}>
                    {getTypeLabel(interview.interviewType)}
                  </span>
                  <span className="history-date">{formatDate(interview.startedAt || interview.updatedAt)}</span>
                </div>
                <div className="history-card-body">
                  <div className="history-stat">
                    <span className="stat-label">Messages</span>
                    <span className="stat-value">{interview.messages?.length || 0}</span>
                  </div>
                  <div className="history-stat">
                    <span className="stat-label">Model</span>
                    <span className="stat-value model-value">{interview.modelUsed || 'unknown'}</span>
                  </div>
                </div>
                <button 
                  className="history-delete-btn" 
                  onClick={(e) => handleDelete(e, interview.id)}
                  aria-label="Delete interview"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
=======
            {interviews.map((interview) => {
              const meta  = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, emoji: '📄', color: '#64748b' };
              const mName = friendlyModelName(interview.modelUsed);
              const mColor = modelProviderColor(interview.modelUsed);
              return (
                <div
                  key={interview.id}
                  className="history-card"
                  onClick={() => navigate(`/history/${interview.id}`)}
                >
                  {/* Card top row */}
                  <div className="history-card-header">
                    <div className="hcard-left">
                      <span className="hcard-emoji">{meta.emoji}</span>
                      <div>
                        <span className="type-badge" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                          {meta.label}
                        </span>
                        {/* Bug #2 fix: show question title if saved */}
                        {interview.questionTitle && (
                          <div className="hcard-question">{interview.questionTitle}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className="history-date">{formatDate(interview.startedAt || interview.updatedAt)}</span>
                      {interview.scorecard && (
                        <span style={{ fontSize: '11px', background: '#34d39922', color: '#34d399', padding: '2px 6px', borderRadius: '4px', border: '1px solid #34d39955' }}>
                          📊 Scorecard
                        </span>
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

                  {/* Delete button */}
                  <button
                    className="history-delete-btn"
                    onClick={(e) => confirmDelete(e, interview)}
                    aria-label="Delete interview"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bug #6 fix: Styled delete confirmation modal */}
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
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
    </div>
  );
}
