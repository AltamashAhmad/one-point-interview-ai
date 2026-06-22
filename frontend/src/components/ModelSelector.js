import React, { useState, useRef, useEffect } from 'react';
import './ModelSelector.css';

/**
 * All available models with metadata.
 * Ordered: Best choice first per provider. Updated June 2026.
 * provider: 'gemini' | 'groq' | 'openrouter'
 * tier: 1 (Flagship), 2 (Fast Backup), 3 (Heavy Backup)
 */
export const AVAILABLE_MODELS = [
  // ── TIER 1: The Flagships ───────────────────
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    tier: 1,
    badge: 'Best for Coding',
    badgeColor: '#8b5cf6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Fastest new 2026 generation for coding tasks',
    icon: '🚀',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    tier: 1,
    badge: 'Best for System Design',
    badgeColor: '#ec4899',
    rpm: 10,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Google · Absolute best reasoning for complex architectures',
    icon: '🔬',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    tier: 1,
    badge: 'Most Human-Like',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '100K',
    description: 'Groq · Massive open-weights model, lightning fast',
    icon: '🔥',
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen 3 32B',
    provider: 'groq',
    tier: 1,
    badge: 'Flawless DSA',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 1000,
    contextWindow: '128K',
    description: 'Groq · Trained exclusively on code and algorithms',
    icon: '💻',
  },

  // ── TIER 2: Fast Backups ──────────────────
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    provider: 'groq',
    tier: 2,
    badge: 'Newest Gen',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '500K',
    description: 'Groq · Meta\'s newest lightweight Llama 4',
    icon: '🦙',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    provider: 'groq',
    tier: 2,
    badge: 'Highest Quota',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 14400,
    contextWindow: '128K',
    description: 'Groq · Ultra fast · highest quota backup',
    icon: '⚡',
  },
  {
    id: 'qwen/qwen3.6-27b',
    name: 'Qwen 3.6 27B',
    provider: 'groq',
    tier: 2,
    badge: 'Code Backup',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 1000,
    contextWindow: '128K',
    description: 'Groq · Solid alternative for DSA',
    icon: '⌨️',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    tier: 2,
    badge: 'Stable Backup',
    badgeColor: '#8b5cf6',
    rpm: 10,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Extremely stable older generation',
    icon: '✨',
  },

  // ── TIER 3: Heavyweight Backups ──────────────────────────────────────────────
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'groq',
    tier: 3,
    badge: 'Massive Size',
    badgeColor: '#2563eb',
    rpm: 'Unlimited',
    rpd: 'Unlimited',
    contextWindow: '131K',
    description: 'Groq · 120 Billion parameters for deep reasoning',
    icon: '🏋️',
  },
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B',
    provider: 'gemini',
    tier: 3,
    badge: 'Open Weight',
    badgeColor: '#10b981',
    rpm: 15,
    rpd: 1500,
    contextWindow: '128K',
    description: 'Google · OSS Gemma 4 architecture',
    icon: '🌍',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    tier: 3,
    badge: 'Pro Backup',
    badgeColor: '#3b82f6',
    rpm: 15,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Google · Older reasoning generation',
    icon: '🧠',
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];


export default function ModelSelector({ selectedModel, onModelChange, disabled }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || DEFAULT_MODEL;

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (modelId) => {
    onModelChange(modelId);
    setOpen(false);
  };

  return (
    <div className="model-selector" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        className={`model-trigger ${open ? 'model-trigger--open' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title="Switch AI model"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="model-icon">{current.icon}</span>
        <span className="model-trigger-name">{current.name}</span>
        <span className="model-trigger-rpm">{current.rpm} RPM</span>
        <svg
          className={`model-chevron ${open ? 'model-chevron--up' : ''}`}
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="model-dropdown" role="listbox">
          <div className="model-dropdown-header">Choose AI Model</div>

          {/* Tier 1 section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot" style={{background: '#ec4899'}} />
              🌟 Tier 1: The Flagships (Try these first)
            </div>
            {AVAILABLE_MODELS.filter(m => m.tier === 1).map((model) => {
              const isSelected = model.id === selectedModel;
              return (
                <button
                  key={model.id}
                  className={`model-option ${isSelected ? 'model-option--selected' : ''}`}
                  onClick={() => handleSelect(model.id)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="model-option-left">
                    <span className="model-option-icon">{model.icon}</span>
                    <div className="model-option-info">
                      <div className="model-option-name">
                        {model.name}
                        <span
                          className="model-badge"
                          style={{ background: `${model.badgeColor}22`, color: model.badgeColor, border: `1px solid ${model.badgeColor}44` }}
                        >
                          {model.badge}
                        </span>
                      </div>
                      <div className="model-option-desc">{model.description}</div>
                    </div>
                  </div>
                  <div className="model-option-stats">
                    <div className="model-stat">
                      <span className="stat-val">{model.rpm}</span>
                      <span className="stat-label">RPM</span>
                    </div>
                    <div className="model-stat">
                      <span className="stat-val">{model.rpd}</span>
                      <span className="stat-label">RPD</span>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="model-check" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tier 2 section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot" style={{background: '#10b981'}} />
              🟢 Tier 2: Fast Backups
            </div>
            {AVAILABLE_MODELS.filter(m => m.tier === 2).map((model) => {
              const isSelected = model.id === selectedModel;
              return (
                <button
                  key={model.id}
                  className={`model-option ${isSelected ? 'model-option--selected' : ''}`}
                  onClick={() => handleSelect(model.id)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="model-option-left">
                    <span className="model-option-icon">{model.icon}</span>
                    <div className="model-option-info">
                      <div className="model-option-name">
                        {model.name}
                        <span
                          className="model-badge"
                          style={{ background: `${model.badgeColor}22`, color: model.badgeColor, border: `1px solid ${model.badgeColor}44` }}
                        >
                          {model.badge}
                        </span>
                      </div>
                      <div className="model-option-desc">{model.description}</div>
                    </div>
                  </div>
                  <div className="model-option-stats">
                    <div className="model-stat">
                      <span className="stat-val">{model.rpm}</span>
                      <span className="stat-label">RPM</span>
                    </div>
                    <div className="model-stat">
                      <span className="stat-val">{typeof model.rpd === 'number' && model.rpd >= 1000 ? `${(model.rpd/1000).toFixed(1)}K` : model.rpd}</span>
                      <span className="stat-label">RPD</span>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="model-check" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tier 3 section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot" style={{background: '#3b82f6'}} />
              🔵 Tier 3: Heavyweight Backups
            </div>
            {AVAILABLE_MODELS.filter(m => m.tier === 3).map((model) => {
              const isSelected = model.id === selectedModel;
              return (
                <button
                  key={model.id}
                  className={`model-option ${isSelected ? 'model-option--selected' : ''}`}
                  onClick={() => handleSelect(model.id)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="model-option-left">
                    <span className="model-option-icon">{model.icon}</span>
                    <div className="model-option-info">
                      <div className="model-option-name">
                        {model.name}
                        <span
                          className="model-badge"
                          style={{ background: `${model.badgeColor}22`, color: model.badgeColor, border: `1px solid ${model.badgeColor}44` }}
                        >
                          {model.badge}
                        </span>
                      </div>
                      <div className="model-option-desc">{model.description}</div>
                    </div>
                  </div>
                  <div className="model-option-stats">
                    <div className="model-stat">
                      <span className="stat-val">{model.rpm}</span>
                      <span className="stat-label">RPM</span>
                    </div>
                    <div className="model-stat">
                      <span className="stat-val">{model.rpd}</span>
                      <span className="stat-label">RPD</span>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="model-check" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <div className="model-dropdown-footer">
            RPM = requests/min · RPD = requests/day (free tier)
          </div>
        </div>
      )}
    </div>
  );
}
