import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoopPersist } from '../hooks/useLoopPersist';
import ThemeToggle from '../components/ThemeToggle';
import './Landing.css';

const INTERVIEW_TYPES = [
  {
    id: 'dsa',
    emoji: '🧩',
    label: 'DSA',
    fullName: 'Data Structures & Algorithms',
    description: 'Practice coding problems on arrays, trees, graphs, dynamic programming, and more — just like a real Google or Meta interview.',
    topics: ['Arrays & Strings', 'Trees & Graphs', 'Dynamic Programming', 'Two Pointers', 'Binary Search'],
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.15)',
  },
  {
    id: 'systemDesign',
    emoji: '🏗️',
    label: 'System Design',
    fullName: 'Scalable System Architecture',
    description: 'Design real-world systems at massive scale. Cover requirements, API design, databases, caching, availability, and trade-offs.',
    topics: ['Load Balancing', 'Database Design', 'Caching (Redis)', 'Message Queues', 'Scalability'],
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.15)',
    featured: true,
  },
  {
    id: 'lld',
    emoji: '🔧',
    label: 'LLD',
    fullName: 'Low-Level / OOP Design',
    description: 'Design object-oriented systems applying SOLID principles, design patterns, and clean architecture thinking.',
    topics: ['SOLID Principles', 'Design Patterns', 'Class Design', 'Encapsulation', 'Extensibility'],
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
];

const TUTOR_TYPES = [
  {
    id: 'tutorDsa',
    emoji: '🎓',
    label: 'DSA Tutor',
    fullName: 'Learn Algorithms & Data Structures',
    description: 'AI teaches you step-by-step: brute force → optimal. No pressure, just learning.',
    topics: ['Step-by-Step Guidance', 'Pattern Recognition', 'Complexity Analysis', 'Code Review'],
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 'tutorLld',
    emoji: '🎓',
    label: 'LLD Tutor',
    fullName: 'Learn Object-Oriented Design',
    description: 'Master design patterns, SOLID principles, and class modeling with AI guidance.',
    topics: ['Design Patterns', 'SOLID Principles', 'UML & Class Diagrams', 'Entity Modeling'],
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 'tutorSystemDesign',
    emoji: '🎓',
    label: 'System Design Tutor',
    fullName: 'Learn Scalable Architecture',
    description: 'AI walks you through designing large-scale systems from scratch.',
    topics: ['Capacity Estimation', 'Database Selection', 'Caching Strategies', 'Load Balancing'],
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
];

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { createLoop, getLoops, deleteLoop, migrateLocalLoops } = useLoopPersist();
  const [loggingOut, setLoggingOut] = useState(false);

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [loopCompany, setLoopCompany] = useState('');
  const [loopLevel, setLoopLevel] = useState('L4');
  const [creatingLoop, setCreatingLoop] = useState(false);

  const [myLoops, setMyLoops] = useState([]);
  const [loadingLoops, setLoadingLoops] = useState(true);

  const refreshLoops = useCallback(async () => {
    try {
      const loops = await getLoops();
      setMyLoops(loops || []);
    } catch (err) {
      console.error('Failed to load loops:', err);
    } finally {
      setLoadingLoops(false);
    }
  }, [getLoops]);

  useEffect(() => {
    let active = true;
    (async () => {
      await migrateLocalLoops();
      if (active) await refreshLoops();
    })();
    return () => { active = false; };
  }, [migrateLocalLoops, refreshLoops]);

  const handleCreateLoop = async (e) => {
    e.preventDefault();
    if (!loopCompany.trim() || creatingLoop) return;

    const roundsArray = [
      { type: 'dsa', name: 'Coding - Data Structures' },
      { type: 'dsa', name: 'Coding - Algorithms' },
      { type: 'systemDesign', name: 'System Design' },
      { type: 'managerial', name: 'Behavioral & Leadership' }
    ];

    setCreatingLoop(true);
    try {
      const newLoop = await createLoop(loopCompany, loopLevel, roundsArray);
      navigate('/loop/' + newLoop.id);
    } catch (err) {
      console.error('Failed to create loop:', err);
      alert('Could not create the loop. Please try again.');
      setCreatingLoop(false);
    }
  };

  const handleDeleteLoop = async (e, loopId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this interview loop? This cannot be undone.')) return;
    try {
      await deleteLoop(loopId);
      setMyLoops((prev) => prev.filter((l) => l.id !== loopId));
    } catch (err) {
      console.error('Failed to delete loop:', err);
      alert('Could not delete the loop. Please try again.');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🎯</span>
          <span className="brand-name">OnePoint<span className="brand-ai"> AI</span></span>
        </div>
        <div className="navbar-right">
          <div className="user-info">
            {user?.photoURL && (
              <img src={user.photoURL} alt={user.displayName} className="user-avatar" referrerPolicy="no-referrer" />
            )}
            <span className="user-name">{user?.displayName || user?.email?.split('@')[0]}</span>
          </div>
          <ThemeToggle />
          <button className="btn btn-ghost" onClick={() => navigate('/history')} style={{ marginRight: '12px' }}>
            History
          </button>
          <button className="btn btn-outline" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-badge">🚀 Free · No limits · Powered by Groq &amp; Gemini AI</div>
        <h1 className="hero-title">
          Ace Your <span className="gradient-text">FAANG Interview</span><br />
          with an AI Interviewer
        </h1>
        <p className="hero-subtitle">
          Practice with a real AI that challenges you exactly like a senior FAANG engineer. <br />
          DSA problems, system design, and OOP design — all in one place.
        </p>
        <div className="hero-stats">
          <div className="stat"><strong>8,177</strong><span>Real Questions</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>464</strong><span>Companies</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>7</strong><span>AI Models</span></div>
        </div>
      </header>

      {/* Interview Type Cards */}
      <main className="cards-section">
        {/* Loop Banner */}
        <div className="loop-banner" onClick={() => setShowLoopModal(true)}>
          <div className="loop-banner-content">
            <h2>🏢 Mock It: Full Company Interview Loop</h2>
            <p>Simulate a complete 4-round FAANG onsite loop (2x DSA, 1x System Design, 1x Managerial). End-to-end evaluation.</p>
          </div>
          <button className="btn btn-outline" style={{ borderColor: 'white', color: 'white' }}>
            Setup Loop →
          </button>
        </div>

        {/* Roadmap Banner */}
        <div className="loop-banner" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '16px' }} onClick={() => navigate('/roadmap')}>
          <div className="loop-banner-content">
            <h2>🗺️ NeetCode 150 Roadmap</h2>
            <p>Master Data Structures & Algorithms step-by-step. Track your progress and practice with guided AI Tutor dry runs or Mock Interviews.</p>
          </div>
          <button className="btn btn-outline" style={{ borderColor: 'white', color: 'white' }}>
            View Roadmap →
          </button>
        </div>

        {/* My Loops — resume any saved loop from any device */}
        {!loadingLoops && myLoops.length > 0 && (
          <div className="my-loops-section">
            <h2 className="section-title">📌 My Interview Loops</h2>
            <div className="my-loops-grid">
              {myLoops.map((loop) => {
                const total = loop.rounds?.length || 0;
                const completed = (loop.rounds || []).filter(
                  (r) => r.status === 'passed' || r.status === 'failed'
                ).length;
                return (
                  <div
                    key={loop.id}
                    className="my-loop-card"
                    onClick={() => navigate('/loop/' + loop.id)}
                  >
                    <button
                      className="my-loop-delete"
                      title="Delete loop"
                      onClick={(e) => handleDeleteLoop(e, loop.id)}
                    >
                      ✕
                    </button>
                    <div className="my-loop-header">
                      <span className="my-loop-company">{loop.company}</span>
                      <span className="my-loop-level">{loop.level}</span>
                    </div>
                    <div className={`my-loop-status ${loop.status}`}>
                      {(loop.status || 'in-progress').replace('-', ' ')}
                    </div>
                    <div className="my-loop-progress">
                      {completed} / {total} rounds done
                    </div>
                    <span className="my-loop-resume">Resume →</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <h2 className="section-title">Choose your interview type</h2>
        <div className="cards-grid">
          {INTERVIEW_TYPES.map((type) => (
            <InterviewCard
              key={type.id}
              type={type}
              onStart={() => navigate(`/interview/${type.id}`)}
            />
          ))}
        </div>

        {/* 🎓 Tutor Mode Section */}
        <div className="section-divider">
          <span className="section-divider-text">🎓 Learn & Practice</span>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          Not ready for interviews yet? Let AI teach you step-by-step. No timer. No pressure.
        </p>
        <div className="cards-grid">
          {TUTOR_TYPES.map((t) => (
            <InterviewCard key={t.id} type={t} onStart={() => navigate(`/interview/${t.id}`)} />
          ))}
        </div>
      </main>

      {/* Tips */}
      <section className="tips-section">
        <h2 className="section-title">💡 Interview Tips</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <span className="tip-icon">🗣️</span>
            <h3>Think Out Loud</h3>
            <p>Always verbalize your thought process. The AI rewards communicating your reasoning, not just the final answer.</p>
          </div>
          <div className="tip-card">
            <span className="tip-icon">❓</span>
            <h3>Clarify First</h3>
            <p>Before jumping in, ask clarifying questions. Real FAANG interviewers expect this.</p>
          </div>
          <div className="tip-card">
            <span className="tip-icon">⚡</span>
            <h3>Start Simple</h3>
            <p>Give a working brute-force first, then optimize. Don't try to jump to the perfect solution immediately.</p>
          </div>
        </div>
      </section>

      {/* Loop Creation Modal */}
      {showLoopModal && (
        <div className="modal-backdrop" onClick={() => setShowLoopModal(false)}>
          <div className="modal-content loop-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLoopModal(false)}>✕</button>
            <h2>Create Interview Loop</h2>
            <p className="modal-subtitle">Configure your mock onsite loop.</p>
            <form onSubmit={handleCreateLoop}>
              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Google, Meta, Amazon" 
                  value={loopCompany}
                  onChange={e => setLoopCompany(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Target Level</label>
                <select value={loopLevel} onChange={e => setLoopLevel(e.target.value)}>
                  <option value="L3">L3 / SDE I (Junior)</option>
                  <option value="L4">L4 / SDE II (Mid)</option>
                  <option value="L5">L5 / Senior</option>
                  <option value="L6">L6 / Staff</option>
                </select>
              </div>
              <div className="loop-rounds-preview">
                <h4>Standard Loop Preview:</h4>
                <ol>
                  <li>Coding - Data Structures</li>
                  <li>Coding - Algorithms</li>
                  <li>System Design</li>
                  <li>Behavioral & Leadership</li>
                </ol>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowLoopModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingLoop}>
                  {creatingLoop ? 'Creating...' : 'Create Loop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewCard({ type, onStart }) {
  return (
    <div
      className={`interview-card ${type.featured ? 'featured' : ''}`}
      style={{ '--card-color': type.color, '--card-glow': type.glow }}
    >
      {type.featured && <div className="card-badge">Most Popular</div>}
      <div className="card-header">
        <span className="card-emoji">{type.emoji}</span>
        <div>
          <div className="card-label" style={{ color: type.color }}>{type.label}</div>
          <div className="card-fullname">{type.fullName}</div>
        </div>
      </div>
      <p className="card-description">{type.description}</p>
      <div className="card-topics">
        {type.topics.map((topic) => (
          <span key={topic} className="topic-tag" style={{ '--tag-color': type.color }}>
            {topic}
          </span>
        ))}
      </div>
      <button className="btn card-btn" onClick={onStart} style={{ background: type.color }}>
        {type.id.startsWith('tutor') ? 'Start Learning →' : 'Start Interview →'}
      </button>
    </div>
  );
}
