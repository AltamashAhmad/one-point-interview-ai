import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory, deleteSession } from '../services/api';
import './History.css';

export default function History() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

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
      </header>

      <main className="history-main">
        {loading ? (
          <div className="history-loading">Loading past interviews...</div>
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
    </div>
  );
}
