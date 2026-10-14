import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from './markdownComponents';
import CodeAuditCard from './CodeAuditCard';
import { Icon } from './ui';
import './MessageBubble.css';

/* ── Main Component ───────────────────────────────────────────────────── */
function MessageBubble({ message, typeColor }) {
  const isAI = message.role === 'assistant';

  return (
    <div className={`message-row ${isAI ? 'message-ai' : 'message-user'}`}>
      {isAI && (
        <div className="avatar-ai" style={{ borderColor: typeColor }}>
          <Icon name="sparkles" size={16} />
        </div>
      )}

      <div
        className={`bubble ${isAI ? 'bubble-ai' : 'bubble-user'}`}
        style={!isAI ? { background: typeColor } : {}}
      >
        {isAI ? (
          message.audit ? (
            <CodeAuditCard audit={message.audit} />
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {/* Half-written diagrams can't render, so show them as plain code until the reply finishes. */}
              {message.streaming ? message.content.replace(/```mermaid/g, '```text') : message.content}
            </ReactMarkdown>
          )
        ) : (
          // Render as markdown too — code submissions embed fenced ```code blocks
          // that must not show up as literal backtick text.
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
