import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
        <div className="hero-badge">🚀 Free · No limits · Powered by Gemini AI</div>
        <h1 className="hero-title">
          Ace Your <span className="gradient-text">FAANG Interview</span><br />
          with an AI Interviewer
        </h1>
        <p className="hero-subtitle">
          Practice with a real AI that challenges you exactly like a senior FAANG engineer. <br />
          DSA problems, system design, and OOP design — all in one place.
        </p>
        <div className="hero-stats">
          <div className="stat"><strong>3</strong><span>Interview Types</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>∞</strong><span>Practice Sessions</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>Free</strong><span>Forever</span></div>
        </div>
      </header>

      {/* Interview Type Cards */}
      <main className="cards-section">
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
        Start Interview →
      </button>
    </div>
  );
}
