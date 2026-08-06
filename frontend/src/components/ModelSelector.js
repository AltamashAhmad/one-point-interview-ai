import React, { useState, useRef, useEffect } from 'react';
import './ModelSelector.css';

/**
 * All available models with metadata.
 * Ordered: Best choice first per provider. Updated June 2026.
 * The IDs remain identical so the backend API routing works flawlessly,
 * but the display names are masked to look like internal proprietary models.
 */
export const AVAILABLE_MODELS = [
  // ── TIER 1: The Flagships ───────────────────
  {
    id: 'llama-3.1-8b-instant',
    name: 'OPI Fast',
    provider: 'internal',
    tier: 1,
    badge: 'Highest Quota',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 14400,
    contextWindow: '128K',
    description: 'Ultra fast · highest quota',
    icon: '⚡',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'OPI Coder',
    provider: 'internal',
    tier: 1,
    badge: 'Best for Coding',
    badgeColor: '#8b5cf6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Fastest generation for coding tasks',
    icon: '🚀',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'OPI Pro',
    provider: 'internal',
    tier: 1,
    badge: 'Best for System Design',
    badgeColor: '#ec4899',
    rpm: 10,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Absolute best reasoning for complex architectures',
    icon: '🔬',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'OPI Versatile',
    provider: 'internal',
    tier: 1,
    badge: 'Most Human-Like',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '100K',
    description: 'Massive open-weights model, lightning fast',
    icon: '🔥',
  },
  {
    id: 'qwen-2.5-coder-32b',
    name: 'OPI Algorithmic',
    provider: 'internal',
    badge: 'New Coder',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 1000,
    contextWindow: '128K',
    description: 'Trained exclusively on code and algorithms',
    icon: '💻',
  },

  // ── TIER 2: Fast Backups ──────────────────
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'OPI Scout',
    provider: 'internal',
    tier: 2,
    badge: 'Newest Gen',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '500K',
    description: 'Newest lightweight model variant',
    icon: '🦙',
  },
  {
    id: 'qwen/qwen3.6-27b',
    name: 'OPI Standard',
    provider: 'internal',
    tier: 2,
    badge: 'Code Backup',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 1000,
    contextWindow: '128K',
    description: 'Solid alternative for DSA',
    icon: '⌨️',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'OPI Flash',
    provider: 'internal',
    tier: 2,
    badge: 'Stable Backup',
    badgeColor: '#8b5cf6',
    rpm: 10,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Extremely stable older generation',
    icon: '✨',
  },

  // ── TIER 3: Heavyweight Backups ──────────────────────────────────────────────
  {
    id: 'openai/gpt-oss-120b',
    name: 'OPI Heavyweight',
    provider: 'internal',
    tier: 3,
    badge: 'Massive Size',
    badgeColor: '#2563eb',
    rpm: 'Unlimited',
    rpd: 'Unlimited',
    contextWindow: '131K',
    description: '120 Billion parameters for deep reasoning',
    icon: '🏋️',
  },
  {
    id: 'gemma-4-31b-it',
    name: 'OPI Open',
    provider: 'internal',
    tier: 3,
    badge: 'Open Weight',
    badgeColor: '#10b981',
    rpm: 15,
    rpd: 1500,
    contextWindow: '128K',
    description: 'OSS architecture',
    icon: '🌍',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'OPI Legacy Pro',
    provider: 'internal',
    tier: 3,
    badge: 'Pro Backup',
    badgeColor: '#3b82f6',
    rpm: 15,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Older reasoning generation',
    icon: '🧠',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'OPI Lite',
    provider: 'internal',
    tier: 3,
    badge: 'Newest',
    badgeColor: '#3b82f6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Latest generation',
    icon: '🔬',
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
