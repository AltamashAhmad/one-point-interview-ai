import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHistoryById, generateNotes, updateNotes } from '../services/api';
import { TYPE_CONFIG, formatDate, friendlyModelName } from '../utils/constants';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import MessageBubble from '../components/MessageBubble';
import ThemeToggle from '../components/ThemeToggle';
import './HistoryDetail.css';

// Extend friendlyModelName with icon for detail page
function friendlyModelNameWithIcon(modelId) {
  const found = AVAILABLE_MODELS.find(m => m.id === modelId);
  return found ? `${found.icon} ${found.name}` : friendlyModelName(modelId);
}

export default function HistoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'notes'
  
  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchInterview = useCallback(async () => {
    try {
      const data = await getHistoryById(id);
      setInterview(data);
      if (data.notes) {
        setNotesContent(data.notes);
      }
    } catch (err) {
      setError('Failed to load this interview session.');
    } finally {
      setLoading(false);
    }
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

  const handleGenerateNotes = async () => {
    setGeneratingNotes(true);
    try {
      const generated = await generateNotes(id, interview.modelUsed);
      setNotesContent(generated);
      setInterview(prev => ({ ...prev, notes: generated }));
    } catch (err) {
      alert('Failed to generate notes: ' + err.message);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await updateNotes(id, notesContent);
      setNotesContent(updated);
      setInterview(prev => ({ ...prev, notes: updated }));
      setIsEditingNotes(false);
    } catch (err) {
      alert('Failed to save notes: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) return <div className="history-detail-loading">Loading session…</div>;
  if (error)   return <div className="history-detail-error">{error}</div>;
  if (!interview) return null;

  const config = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, color: '#64748b', emoji: '📄' };
  const date   = formatDate(interview.startedAt || interview.updatedAt);
  const msgCount = interview.messages?.length || 0;

  return (
    <div className="history-detail-page">
      <header className="history-detail-header" style={{ '--type-color': config.color }}>
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

        <div className="header-actions">
          {interview.scorecard && (
            <button className="btn btn-primary" onClick={() => navigate(`/scorecard/${id}`)} style={{ padding: '8px 16px', fontSize: '13px' }}>
              View Scorecard
            </button>
          )}
          <button className="copy-btn" onClick={handleCopy} title="Copy conversation">
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
          <ThemeToggle />
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

      <div className="history-tabs">
        <button className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => setActiveTab('transcript')}>Transcript</button>
        <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>My Notes</button>
      </div>

      <main className="history-chat-area">
        {activeTab === 'transcript' ? (
          <div className="messages-container">
            <div className="review-banner">📖 Read-only session review</div>
            {interview.messages?.map((msg, i) => (
              <MessageBubble key={i} message={msg} typeColor={config.color} />
            ))}
          </div>
        ) : (
          <div className="notes-container">
            {!interview.notes && !generatingNotes ? (
              <div className="notes-empty-state">
                <h3>No notes generated yet.</h3>
                <p>Let AI analyze this interview and generate a structured revision note covering the intuition, brute force, optimization path, and optimal code.</p>
                <button className="btn btn-primary" onClick={handleGenerateNotes}>
                  ✨ Generate AI Notes
                </button>
              </div>
            ) : generatingNotes ? (
              <div className="notes-loading-state">
                <div className="spinner" />
                <p>Analyzing transcript and generating notes...</p>
              </div>
            ) : isEditingNotes ? (
              <div className="notes-editor-wrapper">
                <div className="notes-editor-actions">
                  <button className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setIsEditingNotes(false); setNotesContent(interview.notes); }} disabled={savingNotes}>
                    Cancel
                  </button>
                </div>
                <textarea 
                  className="notes-textarea" 
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Type your notes here in Markdown..."
                />
              </div>
            ) : (
              <div className="notes-view-wrapper">
                <div className="notes-view-actions">
                  <button className="btn btn-outline" onClick={() => setIsEditingNotes(true)}>
                    ✏️ Edit Notes
                  </button>
                </div>
                <div className="bubble bubble-ai" style={{ width: '100%', maxWidth: 'none', background: 'var(--bg-card)' }}>
                  <MessageBubble message={{ role: 'assistant', content: notesContent }} typeColor={config.color} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
