<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHistoryById } from '../services/api';
import MessageBubble from '../components/MessageBubble';
import './HistoryDetail.css';

const TYPE_CONFIG = {
  dsa: { label: 'DSA', color: '#3b82f6', emoji: '🧩' },
  systemDesign: { label: 'System Design', color: '#8b5cf6', emoji: '🏗️' },
  lld: { label: 'LLD', color: '#10b981', emoji: '🔧' },
};
=======
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHistoryById } from '../services/api';
import { TYPE_CONFIG, formatDate, friendlyModelName } from '../utils/constants';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import MessageBubble from '../components/MessageBubble';
import './HistoryDetail.css';

// Extend friendlyModelName with icon for detail page
function friendlyModelNameWithIcon(modelId) {
  const found = AVAILABLE_MODELS.find(m => m.id === modelId);
  return found ? `${found.icon} ${found.name}` : friendlyModelName(modelId);
}
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)

export default function HistoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
<<<<<<< HEAD
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchInterview = async () => {
=======
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [copied,    setCopied]    = useState(false);

  const fetchInterview = useCallback(async () => {
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
    try {
      const data = await getHistoryById(id);
      setInterview(data);
    } catch (err) {
      setError('Failed to load this interview session.');
    } finally {
      setLoading(false);
    }
<<<<<<< HEAD
  };

  if (loading) return <div className="history-detail-loading">Loading session...</div>;
  if (error) return <div className="history-detail-error">{error}</div>;
  if (!interview) return null;

  const config = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, color: '#64748b', emoji: '📄' };
=======
  }, [id]);

  useEffect(() => {
    fetchInterview();
  }, [fetchInterview]);

  const handleCopy = () => {
    if (!interview?.messages) return;
    const text = interview.messages
      .map(m => `[${m.role === 'user' ? 'You' : 'Interviewer'}]\n${m.content}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="history-detail-loading">Loading session…</div>;
  if (error)   return <div className="history-detail-error">{error}</div>;
  if (!interview) return null;

  const config = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, color: '#64748b', emoji: '📄' };
  const date   = formatDate(interview.startedAt || interview.updatedAt);
  const msgCount = interview.messages?.length || 0;
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)

  return (
    <div className="history-detail-page">
      <header className="history-detail-header" style={{ '--type-color': config.color }}>
<<<<<<< HEAD
        <button className="back-btn" onClick={() => navigate('/history')}>
          ← Back to History
        </button>
        <div className="header-info">
          <span className="type-emoji">{config.emoji}</span>
          <div className="header-titles">
            <h2>{config.label} Interview Review</h2>
            <div className="header-meta">
              Model: <span className="mono">{interview.modelUsed}</span>
            </div>
          </div>
        </div>
        <div className="header-placeholder"></div>
      </header>

      <main className="history-chat-area">
        <div className="messages-container">
          <div className="review-banner">
            This is a past session (read-only mode).
          </div>
=======
        <button className="back-btn" onClick={() => navigate('/history')}>← Back</button>

        <div className="header-info">
          <span className="type-emoji">{config.emoji}</span>
          <div className="header-titles">
            <h2>{config.label} Interview</h2>
            {/* Bug #3 fix: show question title if we have it */}
            {interview.questionTitle && (
              <div className="header-question-title">
                <span>{interview.questionTitle}</span>
                {interview.questionLink && (
                  <a href={interview.questionLink} target="_blank" rel="noopener noreferrer" className="lc-link">
                    LeetCode ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
          {interview.scorecard && (
            <button className="btn btn-primary" onClick={() => navigate(`/scorecard/${id}`)} style={{ padding: '8px 16px', fontSize: '13px' }}>
              View Scorecard
            </button>
          )}
          <button className="copy-btn" onClick={handleCopy} title="Copy conversation">
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      </header>

      {/* Bug #3 fix: rich metadata bar */}
      <div className="detail-meta-bar">
        {interview.company && (
          <div className="meta-item"><span className="meta-label">Company</span><span className="meta-val">🏢 {interview.company}</span></div>
        )}
        {interview.difficulty && interview.difficulty !== 'ANY' && (
          <div className="meta-item"><span className="meta-label">Difficulty</span><span className="meta-val">⚡ {interview.difficulty}</span></div>
        )}
        {interview.language && (
          <div className="meta-item"><span className="meta-label">Language</span><span className="meta-val">💻 {interview.language}</span></div>
        )}
        <div className="meta-item">
          <span className="meta-label">Model</span>
          <span className="meta-val">{friendlyModelNameWithIcon(interview.modelUsed)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Messages</span>
          <span className="meta-val">{msgCount}</span>
        </div>
        {date && (
          <div className="meta-item">
            <span className="meta-label">Date</span>
            <span className="meta-val">{date}</span>
          </div>
        )}
      </div>

      <main className="history-chat-area">
        <div className="messages-container">
          <div className="review-banner">📖 Read-only session review</div>
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
          {interview.messages?.map((msg, i) => (
            <MessageBubble key={i} message={msg} typeColor={config.color} />
          ))}
        </div>
      </main>
    </div>
  );
}
