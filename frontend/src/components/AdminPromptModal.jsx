import React, { useState } from 'react';
import { Button, Dialog } from './ui';
import './AdminPromptBody.css';

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
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={promptData.error ? 'Error generating prompt' : 'Generated system prompt'}
      footer={promptData.error ? null : (
        <Button variant="primary" icon={copied ? 'check' : 'copy'} onClick={handleCopy}>
          {copied ? 'Copied to clipboard' : 'Copy prompt'}
        </Button>
      )}
    >
      {promptData.error ? (
        <p className="admin-prompt-error">{promptData.error}</p>
      ) : (
        <>
          {promptData.questionData && (
            <div className="admin-prompt-question-meta">
              <strong>Seed question:</strong> {promptData.questionData.title}
            </div>
          )}
          <textarea className="admin-prompt-textarea" readOnly value={promptData.prompt} />
        </>
      )}
    </Dialog>
  );
}
