import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NEETCODE_150 } from '../services/neetcode150';
import { getHistory, pinSession, getMyProfile, toggleUncheckQuestion } from '../services/api';
import { TYPE_CONFIG, formatDate, friendlyModelName, modelProviderColor } from '../utils/constants';
import ThemeToggle from '../components/ThemeToggle';
import ModelSelector, { AVAILABLE_MODELS } from '../components/ModelSelector';
import { generateAdminPrompt } from '../services/api';
import AdminPromptModal from '../components/AdminPromptModal';
import { useAuth } from '../contexts/AuthContext';
import './Roadmap.css';

export default function Roadmap({ adminPromptMode }) {
  const { user } = useAuth();
  const [completedTitles, setCompletedTitles] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState(new Set([NEETCODE_150[0]?.topic]));
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [selectedLanguage, setSelectedLanguage] = useState('Java');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [uncheckedTitles, setUncheckedTitles] = useState(new Set());
  const [expandedHistoryQuestion, setExpandedHistoryQuestion] = useState(null);
  const [promptData, setPromptData] = useState(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const navigate = useNavigate();

  const toggleTopic = (topicName) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicName)) next.delete(topicName);
      else next.add(topicName);
      return next;
    });
  };

  useEffect(() => {
    async function fetchCompleted() {
      try {
        const [history, profile] = await Promise.all([getHistory(), getMyProfile()]);
        setHistoryRecords(history);
        const titles = new Set(history.map(h => h.questionTitle).filter(Boolean));
        setCompletedTitles(titles);
        setUncheckedTitles(new Set(profile.uncheckedQuestions || []));
      } catch (err) {
        console.error("Failed to load history for roadmap", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCompleted();
  }, []);

  const handlePin = async (e, interview) => {
    e.stopPropagation();
    try {
      const result = await pinSession(interview.id);
      setHistoryRecords(prev =>
        prev.map(i => i.id === interview.id ? { ...i, isPinned: result.isPinned } : i)
      );
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update pin.');
    }
  };

  const handleToggleUncheck = async (e, title, makeUnchecked) => {
    e.stopPropagation();
    try {
      await toggleUncheckQuestion(title, makeUnchecked);
      setUncheckedTitles(prev => {
        const next = new Set(prev);
        if (makeUnchecked) next.add(title);
        else next.delete(title);
        return next;
      });
    } catch (err) {
      console.error('Failed to update uncheck status:', err);
    }
  };

  const handleStart = async (type) => {
    if (!selectedQuestion) return;

    if (adminPromptMode) {
      try {
        setGeneratingPrompt(true);
        const data = await generateAdminPrompt({ 
          interviewType: type, 
          userName: user?.displayName,
          config: { questionSeed: selectedQuestion.title }
        });
        setPromptData(data);
        setSelectedQuestion(null); // Close the option selector
      } catch (err) {
        setPromptData({ error: err.response?.data?.error || 'Failed to generate prompt' });
      } finally {
        setGeneratingPrompt(false);
      }
      return;
    }

    // Pass state to the Interview page via router state so it can prepopulate
    navigate(`/interview/${type}`, {
      state: {
        autoStart: true,
        interviewType: type,
        questionSeed: selectedQuestion.title,
        model: selectedModel.id,
        language: selectedLanguage
      }
    });
  };

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <button className="back-btn" onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')}>← Back</button>
        <h1>NeetCode 150 Roadmap</h1>
        <ThemeToggle />
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading progress...</div>
      ) : (
        <div className="roadmap-content">
          {NEETCODE_150.map((topicBlock) => {
            const topicCompleted = topicBlock.questions.filter(q => completedTitles.has(q.title) && !uncheckedTitles.has(q.title)).length;
            const total = topicBlock.questions.length;
            
            return (
              <section key={topicBlock.topic} className="topic-section">
                <h2 className="topic-header" onClick={() => toggleTopic(topicBlock.topic)} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <span style={{ display: 'inline-block', width: '24px', transition: 'transform 0.2s', transform: expandedTopics.has(topicBlock.topic) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    {topicBlock.topic}
                  </span>
                  <span className="topic-progress">{topicCompleted} / {total}</span>
                </h2>
                
                {expandedTopics.has(topicBlock.topic) && (
                  <div className="question-list">
                    {topicBlock.questions.map((q) => {
                    const hasHistory = completedTitles.has(q.title);
                    const isUnchecked = uncheckedTitles.has(q.title);
                    const isCompleted = hasHistory && !isUnchecked;
                    
                    return (
                      <React.Fragment key={q.id}>
                        <div
                        className={`question-item ${isCompleted ? 'completed' : ''}`}
                        onClick={() => setSelectedQuestion(q)}
                      >
                        <div className="question-left">
                          <span className="status-icon">
                            {isCompleted ? '✅' : '⬜'}
                          </span>
                          <span className="question-title">{q.title}</span>
                        </div>
                        <div className="question-right">
                          <span className={`difficulty-badge diff-${q.difficulty}`}>
                            {q.difficulty}
                          </span>
                          <div className="roadmap-actions-container" style={{ display: 'flex', gap: '8px', width: '64px', justifyContent: 'flex-end' }}>
                            {hasHistory && (
                              <button
                                className={`roadmap-action-btn ${isUnchecked ? 'unchecked' : ''}`}
                                title={isUnchecked ? "Mark as solved" : "Mark as unsolved"}
                                onClick={(e) => handleToggleUncheck(e, q.title, !isUnchecked)}
                              >
                                {isUnchecked ? '👁️' : '🚫'}
                              </button>
                            )}
                            {hasHistory && (
                              <button
                                className="roadmap-history-btn roadmap-action-btn"
                                title="View history for this question"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedHistoryQuestion(prev => prev === q.title ? null : q.title);
                                }}
                              >
                                📜
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {expandedHistoryQuestion === q.title && (
                        <div className="inline-history-container">
                          {historyRecords.filter(h => h.questionTitle === q.title).map(interview => {
                            const meta = TYPE_CONFIG[interview.interviewType] || { label: interview.interviewType, emoji: '📄', color: '#64748b' };
                            const mName = friendlyModelName(interview.modelUsed);
                            const mColor = modelProviderColor(interview.modelUsed);
                            
                            return (
                              <div key={interview.id} className={`inline-history-row ${interview.isPinned ? 'pinned' : ''}`} onClick={() => navigate(`/history/${interview.id}`)}>
                                <div className="inline-history-left">
                                  <span className="inline-history-emoji">{meta.emoji}</span>
                                  <div className="inline-history-details">
                                    <span className="inline-history-type" style={{ color: meta.color }}>{meta.label}</span>
                                    <span className="inline-history-date">{formatDate(interview.startedAt || interview.updatedAt)}</span>
                                  </div>
                                </div>
                                <div className="inline-history-right">
                                  <span className="inline-history-model" style={{ color: mColor }}>{mName}</span>
                                  <button
                                    className={`inline-pin-btn ${interview.isPinned ? 'active' : ''}`}
                                    onClick={(e) => handlePin(e, interview)}
                                    title={interview.isPinned ? 'Unpin' : 'Pin session'}
                                  >
                                    {interview.isPinned ? '⭐' : '☆'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                    );
                  })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selectedQuestion && (
        <div className="modal-overlay" onClick={() => setSelectedQuestion(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{selectedQuestion.title}</h3>
            <p className="modal-body">How would you like to practice this question?</p>
            
            <div className="roadmap-modal-settings" style={{ marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>AI Model</label>
                <ModelSelector 
                  selectedModel={selectedModel.id} 
                  onModelChange={(id) => setSelectedModel(AVAILABLE_MODELS.find(m => m.id === id) || AVAILABLE_MODELS[0])} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Language</label>
                <select 
                  value={selectedLanguage} 
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                >
                  {['Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'Go', 'Rust'].map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-options">
              <button className="modal-option-btn" onClick={() => handleStart('tutorDsa')}>
                🧑‍🏫 Start Tutor Session
                <span>Guided step-by-step learning with visual dry runs</span>
              </button>
              <button className="modal-option-btn" onClick={() => handleStart('dsa')}>
                ⏱️ Mock Interview
                <span>Simulated interview environment without hints</span>
              </button>
            </div>
            
            <button className="modal-btn--cancel" onClick={() => setSelectedQuestion(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay for Prompts */}
      {generatingPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner"></div>
        </div>
      )}

      <AdminPromptModal promptData={promptData} onClose={() => setPromptData(null)} />
    </div>
  );
}
