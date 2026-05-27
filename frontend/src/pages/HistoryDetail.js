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

export default function HistoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchInterview = async () => {
    try {
      const data = await getHistoryById(id);
      setInterview(data);
    } catch (err) {
      setError('Failed to load this interview session.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="history-detail-loading">Loading session...</div>;
  if (error) return <div className="history-detail-error">{error}</div>;
  if (!interview) return null;

  const config = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, color: '#64748b', emoji: '📄' };

  return (
    <div className="history-detail-page">
      <header className="history-detail-header" style={{ '--type-color': config.color }}>
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
          {interview.messages?.map((msg, i) => (
            <MessageBubble key={i} message={msg} typeColor={config.color} />
          ))}
        </div>
      </main>
    </div>
  );
}
