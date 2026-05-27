import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';

export default function MessageBubble({ message, typeColor }) {
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
            components={{
              // ── Block Code (triple backticks) ──────────────────
              pre: ({ children }) => (
                <div className="code-block-wrapper">
                  <pre className="code-block">{children}</pre>
                </div>
              ),
              code: ({ children, className, ...props }) => {
                // Block code (inside <pre>) always has a className like language-*
                // Inline code has NO className
                if (className) {
                  return <code className={className} {...props}>{children}</code>;
                }
                // Inline code — subtle, readable
                return <code className="inline-code" {...props}>{children}</code>;
              },

              // ── Text Elements ──────────────────────────────────
              p:      ({ children }) => <p className="md-p">{children}</p>,
              h1:     ({ children }) => <h1 className="md-h1">{children}</h1>,
              h2:     ({ children }) => <h2 className="md-h2">{children}</h2>,
              h3:     ({ children }) => <h3 className="md-h3">{children}</h3>,
              strong: ({ children }) => <strong className="md-strong">{children}</strong>,
              em:     ({ children }) => <em className="md-em">{children}</em>,

              // ── Lists ──────────────────────────────────────────
              ul: ({ children }) => <ul className="md-ul">{children}</ul>,
              ol: ({ children }) => <ol className="md-ol">{children}</ol>,
              li: ({ children }) => <li className="md-li">{children}</li>,

              // ── Divider ────────────────────────────────────────
              hr: () => <hr className="md-hr" />,

              // ── Blockquote (for examples/notes) ───────────────
              blockquote: ({ children }) => (
                <blockquote className="md-blockquote">{children}</blockquote>
              ),
            }}
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
