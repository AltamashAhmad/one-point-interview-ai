import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NEETCODE_150 } from '../services/neetcode150';
import { getHistory } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import './Roadmap.css';

export default function Roadmap() {
  const [completedTitles, setCompletedTitles] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState(new Set([NEETCODE_150[0]?.topic]));
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
        const history = await getHistory();
        const titles = new Set(history.map(h => h.questionTitle).filter(Boolean));
        setCompletedTitles(titles);
      } catch (err) {
        console.error("Failed to load history for roadmap", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCompleted();
  }, []);

  const handleStart = (type) => {
    if (!selectedQuestion) return;
    
    // Pass state to the Interview page via router state so it can prepopulate
    navigate(`/interview/${type}`, {
      state: {
        autoStart: true,
        interviewType: type,
        questionSeed: selectedQuestion.title
      }
    });
  };

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>NeetCode 150 Roadmap</h1>
        <ThemeToggle />
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading progress...</div>
      ) : (
        <div className="roadmap-content">
          {NEETCODE_150.map((topicBlock) => {
            const topicCompleted = topicBlock.questions.filter(q => completedTitles.has(q.title)).length;
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
                    const isCompleted = completedTitles.has(q.title);
                    return (
                      <div 
                        key={q.id} 
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
                        </div>
                      </div>
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
    </div>
  );
}
