import React, { useState } from 'react';
import './AdminPromptModal.css';

export default function AdminPromptModal({ promptData, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!promptData) return null;

  const handleCopy = () => {
    if (!promptData.prompt) return;
    navigator.clipboard.writeText(promptData.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="admin-prompt-modal-overlay" onClick={onClose}>
      <div className="admin-prompt-modal-content" onClick={e => e.stopPropagation()}>
        <div className="admin-prompt-modal-header">
          <h2 style={{ color: promptData.error ? 'var(--text-error, #ef4444)' : 'var(--text-primary)' }}>
            {promptData.error ? '❌ Error Generating Prompt' : '🛠 Generated System Prompt'}
          </h2>
          <button className="admin-prompt-modal-close" onClick={onClose}>✕</button>
        </div>
        
        {promptData.error ? (
          <div style={{ padding: '24px', color: 'var(--text-error, #fca5a5)', fontSize: '1.1rem', textAlign: 'center' }}>
            {promptData.error}
          </div>
        ) : (
          <>
            {promptData.questionData && (
              <div className="admin-prompt-question-meta">
                <strong>Seed Question:</strong> {promptData.questionData.title}
              </div>
            )}

            <div className="admin-prompt-textarea-container">
              <textarea 
                className="admin-prompt-textarea" 
                readOnly 
                value={promptData.prompt} 
              />
            </div>

            <div className="admin-prompt-modal-footer">
              <button className="btn btn-primary" onClick={handleCopy}>
                {copied ? '✅ Copied to Clipboard!' : '📋 Copy Prompt'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
