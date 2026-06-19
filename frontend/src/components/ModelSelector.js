import React, { useState, useRef, useEffect } from 'react';
import './ModelSelector.css';

/**
 * All available models with metadata.
 * Ordered: Best choice first per provider. Updated May 2026.
 * provider: 'gemini' | 'groq'
 */
export const AVAILABLE_MODELS = [
  // ── OpenRouter Models (Massive Capacity) ───────────────────
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT OSS 120B (Free)',
    provider: 'openrouter',
    badge: 'Best for DSA',
    badgeColor: '#2563eb',
    rpm: 'Unlimited',
    rpd: 'Unlimited',
    contextWindow: '131K',
    description: 'OpenAI OSS · Excellent for Data Structures & Algorithms',
    icon: '💻',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA Nemotron 3',
    provider: 'openrouter',
    badge: 'Best for System Design',
    badgeColor: '#4f46e5',
    rpm: 'Unlimited',
    rpd: 'Unlimited',
    contextWindow: '256K',
    description: 'NVIDIA · Advanced architecture and reasoning engine',
    icon: '🧠',
  },

  // ── Groq Models (Fastest) ──────────────────
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    provider: 'groq',
    badge: 'Fast',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '500K',
    description: 'Groq · Meta Llama 4 · fast',
    icon: '🦙',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    badge: 'Best Free Overall',
    badgeColor: '#f97316',
    rpm: 30,
    rpd: 1000,
    contextWindow: '100K',
    description: 'Groq · Fastest and highly reliable general model',
    icon: '🔥',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    provider: 'groq',
    badge: 'Highest Quota',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 14400,
    contextWindow: '128K',
    description: 'Groq · Ultra fast · highest quota',
    icon: '⚡',
  },
  {
    id: 'qwen-2.5-coder-32b',
    name: 'Qwen 2.5 Coder',
    provider: 'groq',
    badge: 'New Coder',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 1000,
    contextWindow: '128K',
    description: 'Groq · Fast & excellent coding',
    icon: '💻',
  },

  // ── Gemini Models ──────────────────────────────────────────────
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    badge: 'Most Powerful',
    badgeColor: '#ec4899',
    rpm: 10,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Google · Absolute best reasoning for complex problems',
    icon: '🔬',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    badge: 'Recommended Gemini',
    badgeColor: '#8b5cf6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Fastest new generation',
    icon: '🚀',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    badge: 'Pro Tier',
    badgeColor: '#3b82f6',
    rpm: 15,
    rpd: 50,
    contextWindow: '2M tokens',
    description: 'Google · Heavy logic & coding',
    icon: '🧠',
  },
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B',
    provider: 'gemini',
    badge: 'Open Weight',
    badgeColor: '#10b981',
    rpm: 15,
    rpd: 1500,
    contextWindow: '128K',
    description: 'Google · OSS Gemma 4',
    icon: '🌍',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    badge: 'Stable',
    badgeColor: '#8b5cf6',
    rpm: 10,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Best stable quality',
    icon: '✨',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    badge: 'Lightweight',
    badgeColor: '#8b5cf6',
    rpm: 30,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Fastest Gemini API',
    icon: '🚀',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    badge: 'Newest',
    badgeColor: '#3b82f6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google · Latest generation',
    icon: '🔬',
  },
  // ── OpenRouter Models ──────────────────────────────────────────
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    badge: 'Best for Logic',
    badgeColor: '#8b5cf6',
    rpm: 'N/A',
    rpd: 'N/A',
    contextWindow: '128K',
    description: 'OpenRouter · DeepSeek Reasoning Model',
    icon: '🧠',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 Chat',
    provider: 'openrouter',
    badge: 'Reasoning',
    badgeColor: '#8b5cf6',
    rpm: 'N/A',
    rpd: 'N/A',
    contextWindow: '128K',
    description: 'OpenRouter · DeepSeek General Chat',
    icon: '🐋',
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

          {/* OpenRouter section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot provider-dot--openrouter" />
              OpenRouter — Free High-Capacity Models
            </div>
            {AVAILABLE_MODELS.filter(m => m.provider === 'openrouter').map((model) => {
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

          {/* Groq section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot provider-dot--groq" />
              Groq — Lightning Fast Inference
            </div>
            {AVAILABLE_MODELS.filter(m => m.provider === 'groq').map((model) => {
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

          {/* Gemini section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot provider-dot--gemini" />
              Google Gemini
            </div>
            {AVAILABLE_MODELS.filter(m => m.provider === 'gemini').map((model) => {
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

          {/* OpenRouter section */}
          <div className="model-provider-group">
            <div className="model-provider-label">
              <span className="provider-dot" style={{ background: '#3b82f6' }} />
              OpenRouter
            </div>
            {AVAILABLE_MODELS.filter(m => m.provider === 'openrouter').map((model) => {
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
