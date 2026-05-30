import React, { useState, useEffect, useRef } from 'react';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './ModelSelector';
import { getCompanyList } from '../services/api';
import './InterviewSetup.css';

const LANGUAGES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
];

const DIFFICULTIES = [
  { id: 'ANY',    label: 'Any',    emoji: '🎲', desc: 'Surprise me'   },
  { id: 'EASY',   label: 'Easy',   emoji: '🟢', desc: 'Warmup round'  },
  { id: 'MEDIUM', label: 'Medium', emoji: '🟡', desc: 'Real interview' },
  { id: 'HARD',   label: 'Hard',   emoji: '🔴', desc: 'Stretch goal'  },
];

export default function InterviewSetup({ interviewType, typeConfig, onBegin }) {
  const isTutor = typeConfig?.isTutor || false;
  const [selectedModel,      setSelectedModel]      = useState(DEFAULT_MODEL.id);
  const [scorecardModel,     setScorecardModel]     = useState('gemini-3.1-pro-preview');
  const [difficulty,         setDifficulty]         = useState('MEDIUM');
  const [language,           setLanguage]           = useState('Python');
  const [company,            setCompany]            = useState('');
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [allCompanies,       setAllCompanies]       = useState([]);
  const [showSuggestions,    setShowSuggestions]    = useState(false);
  const [loadingCompanies,   setLoadingCompanies]   = useState(true);
  const companyInputRef = useRef(null);
  const suggestionsRef  = useRef(null);

  // Load company list for autocomplete
  useEffect(() => {
    getCompanyList()
      .then(list => setAllCompanies(list))
      .catch(() => setAllCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, []);

  // Filter suggestions as user types
  useEffect(() => {
    if (!company.trim() || company.trim().length < 1) {
      setCompanySuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q   = company.toLowerCase();
    const filtered = allCompanies
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 8);
    setCompanySuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [company, allCompanies]);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e) {
      if (
        companyInputRef.current && !companyInputRef.current.contains(e.target) &&
        suggestionsRef.current  && !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectCompany = (name) => {
    setCompany(name);
    setShowSuggestions(false);
    companyInputRef.current?.blur();
  };

  const handleBegin = () => {
    onBegin({ model: selectedModel, scorecardModel: isTutor ? null : scorecardModel, difficulty, language, company: company.trim() });
  };

  const isShowingCompanyForType = interviewType === 'dsa' && !isTutor;

  return (
    <div className="setup-screen">
      {/* Hero */}
      <div className="setup-hero" style={{ '--type-color': typeConfig.color }}>
        <span className="setup-emoji">{typeConfig.emoji}</span>
        <div>
          <div className="setup-type-label" style={{ color: typeConfig.color }}>
            {typeConfig.label} Interview
          </div>
          <h1 className="setup-title">Configure Your Session</h1>
          <p className="setup-subtitle">
            Set up your preferences — we'll pick a real question from our database of
            <strong> 8,177 company-specific problems</strong>.
          </p>
        </div>
      </div>

      <div className="setup-cards">

        {/* Company — DSA only */}
        {isShowingCompanyForType && (
          <div className="setup-card">
            <div className="setup-card-header">
              <span className="setup-card-icon">🏢</span>
              <div>
                <div className="setup-card-title">Target Company</div>
                <div className="setup-card-desc">We'll pick questions frequently asked there</div>
              </div>
            </div>
            <div className="company-input-wrap" style={{ position: 'relative' }}>
              <input
                ref={companyInputRef}
                type="text"
                className="company-input"
                placeholder={loadingCompanies ? 'Loading 464 companies…' : 'e.g. Google, Amazon, Meta…'}
                value={company}
                onChange={e => setCompany(e.target.value)}
                onFocus={() => company && setShowSuggestions(companySuggestions.length > 0)}
                autoComplete="off"
                spellCheck={false}
              />
              {company && (
                <button className="company-clear" onClick={() => { setCompany(''); setShowSuggestions(false); }}>✕</button>
              )}
              {showSuggestions && (
                <ul className="company-suggestions" ref={suggestionsRef}>
                  {companySuggestions.map(c => (
                    <li
                      key={c.slug}
                      className="company-suggestion-item"
                      onMouseDown={() => handleSelectCompany(c.name)}
                    >
                      <span className="suggestion-name">{c.name}</span>
                      <span className="suggestion-count">{c.questionCount} Qs</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="setup-hint">
              Leave blank for a random question from any company
            </div>
          </div>
        )}

        {/* Difficulty */}
        <div className="setup-card">
          <div className="setup-card-header">
            <span className="setup-card-icon">⚡</span>
            <div>
              <div className="setup-card-title">Difficulty</div>
              <div className="setup-card-desc">Choose your challenge level</div>
            </div>
          </div>
          <div className="difficulty-grid">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`difficulty-btn ${difficulty === d.id ? 'difficulty-btn--active' : ''}`}
                onClick={() => setDifficulty(d.id)}
                style={difficulty === d.id ? { borderColor: typeConfig.color, background: `${typeConfig.color}18` } : {}}
              >
                <span className="diff-emoji">{d.emoji}</span>
                <span className="diff-label">{d.label}</span>
                <span className="diff-desc">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language — DSA only */}
        {isShowingCompanyForType && (
          <div className="setup-card">
            <div className="setup-card-header">
              <span className="setup-card-icon">💻</span>
              <div>
                <div className="setup-card-title">Preferred Language</div>
                <div className="setup-card-desc">The interviewer will evaluate your code in this language</div>
              </div>
            </div>
            <div className="language-grid">
              {LANGUAGES.map(lang => (
                <button
                  key={lang}
                  className={`lang-btn ${language === lang ? 'lang-btn--active' : ''}`}
                  onClick={() => setLanguage(lang)}
                  style={language === lang ? { borderColor: typeConfig.color, background: `${typeConfig.color}18`, color: typeConfig.color } : {}}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Model */}
        <div className="setup-card">
          <div className="setup-card-header">
            <span className="setup-card-icon">🤖</span>
            <div>
              <div className="setup-card-title">AI Model</div>
              <div className="setup-card-desc">Choose speed vs quality (you can switch mid-interview for free)</div>
            </div>
          </div>
          <div className="model-grid">
            {AVAILABLE_MODELS.map(m => (
              <button
                key={m.id}
                className={`model-setup-btn ${selectedModel === m.id ? 'model-setup-btn--active' : ''}`}
                onClick={() => setSelectedModel(m.id)}
                style={selectedModel === m.id ? { borderColor: typeConfig.color, background: `${typeConfig.color}18` } : {}}
              >
                <div className="model-setup-top">
                  <span className="model-setup-icon">{m.icon}</span>
                  <span className="model-setup-name">{m.name}</span>
                  {m.badge && (
                    <span
                      className="model-setup-badge"
                      style={{ background: `${m.badgeColor}22`, color: m.badgeColor, border: `1px solid ${m.badgeColor}44` }}
                    >
                      {m.badge}
                    </span>
                  )}
                </div>
                <div className="model-setup-desc">{m.description}</div>
                <div className="model-setup-stats">
                  <span>{m.rpm} RPM</span>
                  <span>·</span>
                  <span>{m.rpd} RPD</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scorecard Model */}
        {!isTutor && (
          <div className="setup-card">
            <div className="setup-card-header">
              <span className="setup-card-icon">📊</span>
              <div>
                <div className="setup-card-title">Scorecard Evaluator Model</div>
                <div className="setup-card-desc">Choose the AI that will grade your performance at the end. Recommended: Gemini 3.1 Pro.</div>
              </div>
            </div>
            <div className="model-grid">
              {AVAILABLE_MODELS.map(m => (
                <button
                  key={`score-${m.id}`}
                  className={`model-setup-btn ${scorecardModel === m.id ? 'model-setup-btn--active' : ''}`}
                  onClick={() => setScorecardModel(m.id)}
                  style={scorecardModel === m.id ? { borderColor: typeConfig.color, background: `${typeConfig.color}18` } : {}}
                >
                  <div className="model-setup-top">
                    <span className="model-setup-icon">{m.icon}</span>
                    <span className="model-setup-name">{m.name}</span>
                    {m.badge && (
                      <span
                        className="model-setup-badge"
                        style={{ background: `${m.badgeColor}22`, color: m.badgeColor, border: `1px solid ${m.badgeColor}44` }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div className="model-setup-desc">{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* Session summary + Begin button */}
      <div className="setup-footer">
        <div className="setup-summary">
          <span className="summary-item" style={{ color: typeConfig.color }}>{typeConfig.fullName}</span>
          {isShowingCompanyForType && company && <><span className="summary-sep">·</span><span className="summary-item">🏢 {company}</span></>}
          <span className="summary-sep">·</span>
          <span className="summary-item">⚡ {DIFFICULTIES.find(d => d.id === difficulty)?.label}</span>
          {isShowingCompanyForType && <><span className="summary-sep">·</span><span className="summary-item">💻 {language}</span></>}
          <span className="summary-sep">·</span>
          <span className="summary-item">🤖 {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}</span>
        </div>
        <button
          className="begin-btn"
          style={{ background: `linear-gradient(135deg, ${typeConfig.color}, ${typeConfig.color}cc)` }}
          onClick={handleBegin}
        >
          {isTutor ? 'Start Learning 🎓' : 'Begin Interview →'}
        </button>
      </div>
    </div>
  );
}
