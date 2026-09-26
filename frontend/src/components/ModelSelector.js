import React, { useState, useRef, useEffect } from 'react';
import './ModelSelector.css';

/**
 * All verified, active free models with accurate names and provider metadata.
 * Only working models are included.
 */
export const AVAILABLE_MODELS = [
  // ── Groq LPUs (Ultra-Low Latency) ───────────────────────────
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'groq',
    badge: '300ms Ultra Fast',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 14400,
    contextWindow: '256K',
    description: 'Blazing-fast inference on Groq LPUs · High accuracy DSA & coding',
    icon: '⚡',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    badge: '120B Reasoning',
    badgeColor: '#2563eb',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '120 Billion parameter model on Groq · In-depth architectural trade-offs & evaluation',
    icon: '🏋️',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'groq',
    badge: 'Fast Reasoning',
    badgeColor: '#0ea5e9',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '20 Billion parameter lightweight reasoning model · Fast & analytical',
    icon: '💡',
  },

  // ── Google AI (Gemini Studio) ───────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    badge: '1M Context',
    badgeColor: '#8b5cf6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google DeepMind model with 1M token context · Exceptional architecture reasoning',
    icon: '🚀',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    badge: 'High Speed',
    badgeColor: '#06b6d4',
    rpm: 30,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Rapid response time by Google · Smooth conversational drills',
    icon: '✨',
  },

  // ── OpenRouter (Multi-Provider Dynamic Failover) ─────────────
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free',
    provider: 'openrouter',
    badge: 'Auto-Failover',
    badgeColor: '#f97316',
    rpm: 20,
    rpd: 1000,
    contextWindow: '200K',
    description: 'Dynamic auto-router that automatically balances across 18+ free models',
    icon: '🛡️',
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];

const PROVIDER_GROUPS = [
  { key: 'groq', label: '⚡ Groq LPUs (Ultra-Low Latency)', dotColor: '#10b981' },
  { key: 'gemini', label: '✨ Google AI (1M Token Context)', dotColor: '#8b5cf6' },
  { key: 'openrouter', label: '🛡️ OpenRouter (Dynamic Auto-Failover)', dotColor: '#f97316' },
];

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

          {PROVIDER_GROUPS.map((group) => {
            const modelsInGroup = AVAILABLE_MODELS.filter((m) => m.provider === group.key);
            if (modelsInGroup.length === 0) return null;

            return (
              <div key={group.key} className="model-provider-group">
                <div className="model-provider-label">
                  <span className="provider-dot" style={{ background: group.dotColor }} />
                  {group.label}
                </div>
                {modelsInGroup.map((model) => {
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
                              style={{
                                background: `${model.badgeColor}22`,
                                color: model.badgeColor,
                                border: `1px solid ${model.badgeColor}44`,
                              }}
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
                          <span className="stat-val">
                            {typeof model.rpd === 'number' && model.rpd >= 1000
                              ? `${(model.rpd / 1000).toFixed(1)}K`
                              : model.rpd}
                          </span>
                          <span className="stat-label">RPD</span>
                        </div>
                      </div>
                      {isSelected && (
                        <svg
                          className="model-check"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="model-dropdown-footer">
            RPM = requests/min · RPD = requests/day (free tier)
          </div>
        </div>
      )}
    </div>
  );
}
