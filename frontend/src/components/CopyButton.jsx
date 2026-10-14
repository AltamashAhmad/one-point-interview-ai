import React, { useState } from 'react';
import { Icon } from './ui';

/** Copy-to-clipboard button for code blocks. */
export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="code-copy-btn" onClick={handleCopy}>
      {copied ? <><Icon name="check" size={14} /> Copied!</> : <><Icon name="copy" size={14} /> Copy</>}
    </button>
  );
}
