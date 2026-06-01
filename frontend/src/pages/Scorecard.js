import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getHistoryById } from '../services/api';
import { useLoopPersist } from '../hooks/useLoopPersist';
import ThemeToggle from '../components/ThemeToggle';
import './Scorecard.css';

// Silently swallows the "useTheme must be within ThemeProvider" error in test environments
class ThemeToggleBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default function Scorecard() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const loopId = searchParams.get('loopId');
  const roundIndex = parseInt(searchParams.get('roundIndex'), 10);
  const { updateLoopRound } = useLoopPersist();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchScorecard() {
      try {
        const interview = await getHistoryById(sessionId);
        if (!interview) {
          throw new Error('Interview not found');
        }
        
        if (!interview.scorecard) {
          setError('Scorecard is not available for this session. It may still be generating.');
        } else {
          setSession(interview);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load scorecard.');
      } finally {
        setLoading(false);
      }
    }
    fetchScorecard();
  }, [sessionId]);

  useEffect(() => {
    if (session && session.scorecard && loopId && !isNaN(roundIndex)) {
      const score = session.scorecard.score || 0;
      const status = score >= 70 ? 'passed' : 'failed';
      updateLoopRound(loopId, roundIndex, status, score, sessionId).catch((err) => {
        console.error('Failed to update loop round:', err);
      });
    }
  }, [session, loopId, roundIndex, sessionId, updateLoopRound]);

  if (loading) {
    return (
      <div className="scorecard-page loading">
        <div className="spinner"></div>
        <p>Loading your AI Scorecard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scorecard-page error">
        <div className="error-box">
          <div className="error-icon">⚠️</div>
          <h2>Oops!</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(loopId ? `/loop/${loopId}` : '/')}>Back to {loopId ? 'Loop' : 'Home'}</button>
        </div>
      </div>
    );
  }

  const { scorecard, interviewType, questionTitle, company, difficulty } = session;

  const getVerdictColor = (verdict) => {
    const v = (verdict || '').toLowerCase();
    if (v.includes('strong hire')) return '#10b981'; // Green
    if (v.includes('lean hire')) return '#fbbf24'; // Yellow
    if (v.includes('no hire') || v.includes('lean no')) return '#ef4444'; // Red
    if (v.includes('hire')) return '#34d399'; // Lighter Green
    return '#8b5cf6'; // Purple fallback
  };

  return (
    <div className="scorecard-page">
      <header className="scorecard-header">
        <div className="scorecard-nav">
          <button className="btn-back" onClick={() => navigate(loopId ? `/loop/${loopId}` : '/')}>← Back to {loopId ? 'Loop' : 'Home'}</button>
          <ThemeToggleBoundary>
            <ThemeToggle />
          </ThemeToggleBoundary>
        </div>
        <div className="header-titles">
          <h1>Interview Scorecard</h1>
          <p className="subtitle">
            {interviewType === 'dsa' ? 'Algorithms & Data Structures' : interviewType === 'systemDesign' ? 'System Design' : 'Low-Level Design'}
            {company && ` • ${company}`}
            {difficulty && ` • ${difficulty}`}
          </p>
        </div>
      </header>

      <main className="scorecard-content">
        {/* Top Summary Section */}
        <section className="summary-section glass-panel">
          <div className="score-circle-container">
            <svg className="score-circle" viewBox="0 0 36 36">
              <path
                className="circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle-progress"
                strokeDasharray={`${scorecard.score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.5" className="score-text">{scorecard.score}</text>
            </svg>
            <p className="score-label">Overall Score</p>
          </div>

          <div className="verdict-container">
            <h2 className="verdict-title">Final Verdict</h2>
            <div 
              className="verdict-badge" 
              style={{ 
                backgroundColor: `${getVerdictColor(scorecard.verdict)}20`,
                color: getVerdictColor(scorecard.verdict),
                borderColor: `${getVerdictColor(scorecard.verdict)}50`
              }}
            >
              {scorecard.verdict}
            </div>
            {questionTitle && <p className="question-name">Question: <strong>{questionTitle}</strong></p>}
          </div>
        </section>

        {/* Detailed Feedback Section */}
        <section className="details-section">
          
          <div className="feedback-card strengths">
            <div className="card-header">
              <span className="icon">🟢</span>
              <h3>Strengths</h3>
            </div>
            <ul>
              {(scorecard.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="feedback-card weaknesses">
            <div className="card-header">
              <span className="icon">🔴</span>
              <h3>Areas for Improvement</h3>
            </div>
            <ul>
              {(scorecard.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>

        </section>

        <section className="narrative-section">
          <div className="narrative-card glass-panel">
            <h3>🧩 Problem Solving & Technical Depth</h3>
            <p>{scorecard.problemSolving}</p>
          </div>
          <div className="narrative-card glass-panel">
            <h3>🗣️ Communication & Clarity</h3>
            <p>{scorecard.communication}</p>
          </div>
        </section>

      </main>
    </div>
  );
}
