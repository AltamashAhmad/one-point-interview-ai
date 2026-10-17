import React, { useState, useRef, useEffect } from 'react';
import './ModelSelector.css';
import { PROVIDER_ICON, findModel, useModels } from '../services/modelCatalog';
import { Icon } from './ui';

const PROVIDER_GROUPS = [
  { key: 'groq', label: 'Groq LPUs (Ultra-Low Latency)', dotColor: '#10b981' },
  { key: 'gemini', label: 'Google AI (1M Token Context)', dotColor: '#8b5cf6' },
  { key: 'openrouter', label: 'OpenRouter (Dynamic Auto-Failover)', dotColor: '#f97316' },
];

export default function ModelSelector({ selectedModel, onModelChange, disabled }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { models } = useModels();
  const current = models.find((m) => m.id === selectedModel) || findModel(selectedModel) || models[0];

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
        <span className="model-icon"><Icon name={PROVIDER_ICON[current.provider] || 'sparkles'} size={16} /></span>
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
        <div className="model-dropdown" role="listbox" aria-label="Choose AI Model">
          <div className="model-dropdown-header">Choose AI Model</div>

          {PROVIDER_GROUPS.map((group) => {
            const modelsInGroup = models.filter((m) => m.provider === group.key);
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
                      className={`model-option ${isSelected ? 'model-option--selected' : ''} ${model.available === false ? 'model-option--busy' : ''}`}
                      onClick={() => handleSelect(model.id)}
                      role="option"
                      aria-selected={isSelected}
                      title={model.available === false ? 'Temporarily busy — your message will automatically use the next available model' : undefined}
                    >
                      <div className="model-option-left">
                        <span className="model-option-icon"><Icon name={PROVIDER_ICON[model.provider] || 'sparkles'} size={16} /></span>
                        <div className="model-option-info">
                          <div className="model-option-name">
                            {model.name}
                            {model.available === false && <span className="model-busy-tag">busy</span>}
                            <span
                              className="model-badge"
                              style={{
                                background: `${model.badgeColor}22`,
                                color: `color-mix(in srgb, ${model.badgeColor} 40%, var(--text-primary))`,
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
