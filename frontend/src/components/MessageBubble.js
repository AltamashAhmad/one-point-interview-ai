import React, { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MessageBubble.css';

/* ── Copy-to-clipboard button for code blocks ─────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button className="code-copy-btn" onClick={handleCopy}>
      {copied ? '✅ Copied!' : '📋 Copy'}
    </button>
  );
}

/* ── Custom markdown component renderers ──────────────────────────────── */
const markdownComponents = {
  // ── Code (block + inline) ──────────────────────────────────────────
  code: ({ children, className, node, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    // Block code — has a language-* class from the markdown fence
    if (match) {
      return (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-lang-label">{language}</span>
            <CopyButton text={codeString} />
          </div>
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '14px 16px',
              borderRadius: '0 0 8px 8px',
              fontSize: '13px',
              lineHeight: '1.7',
              background: '#090e1a',
            }}
            showLineNumbers={codeString.split('\n').length > 5}
            lineNumberStyle={{ color: '#2d3a4f', fontSize: '12px', paddingRight: '16px' }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Block code without language (``` with no lang specified)
    // Detect by checking if parent is a <pre> tag
    const isBlock = node?.position && codeString.includes('\n');
    if (isBlock) {
      return (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-lang-label">code</span>
            <CopyButton text={codeString} />
          </div>
          <SyntaxHighlighter
            language="text"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '14px 16px',
              borderRadius: '0 0 8px 8px',
              fontSize: '13px',
              lineHeight: '1.7',
              background: '#090e1a',
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Inline code
    return <code className="inline-code" {...props}>{children}</code>;
  },

  // ── Pre — just pass through, code handles rendering ────────────────
  pre: ({ children }) => <>{children}</>,

  // ── Text Elements ──────────────────────────────────────────────────
  p:      ({ children }) => <p className="md-p">{children}</p>,
  h1:     ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2:     ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3:     ({ children }) => <h3 className="md-h3">{children}</h3>,
  h4:     ({ children }) => <h4 className="md-h4">{children}</h4>,
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  em:     ({ children }) => <em className="md-em">{children}</em>,

  // ── Lists ──────────────────────────────────────────────────────────
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,

  // ── Divider ────────────────────────────────────────────────────────
  hr: () => <hr className="md-hr" />,

  // ── Blockquote ─────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),

  // ── Tables ─────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="md-table-wrapper">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr:    ({ children }) => <tr className="md-tr">{children}</tr>,
  th:    ({ children }) => <th className="md-th">{children}</th>,
  td:    ({ children }) => <td className="md-td">{children}</td>,

  // ── Links ──────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a className="md-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

/* ── Main Component ───────────────────────────────────────────────────── */
function MessageBubble({ message, typeColor }) {
  const isAI = message.role === 'assistant';

  return (
    <div className={`message-row ${isAI ? 'message-ai' : 'message-user'}`}>
      {isAI && (
        <div className="avatar-ai" style={{ borderColor: typeColor }}>
          🤖
        </div>
      )}

      <div
        className={`bubble ${isAI ? 'bubble-ai' : 'bubble-user'}`}
        style={!isAI ? { background: typeColor } : {}}
      >
        {isAI ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          <p className="user-text">{message.content}</p>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
