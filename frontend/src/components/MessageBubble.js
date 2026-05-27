import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';

export default function MessageBubble({ message, typeColor }) {
  const isAI = message.role === 'assistant';

  return (
    <div className={`message-row ${isAI ? 'message-ai' : 'message-user'}`}>
      {isAI && (
        <div className="avatar avatar-ai" style={{ borderColor: typeColor }}>
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
              pre: ({ children }) => (
                <pre className="code-block">{children}</pre>
              ),
              code: ({ children, className, ...props }) => {
                if (!className) {
                  return (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({ children }) => <p className="md-p">{children}</p>,
              ul: ({ children }) => <ul className="md-list">{children}</ul>,
              ol: ({ children }) => <ol className="md-list md-ol">{children}</ol>,
              li: ({ children }) => <li className="md-li">{children}</li>,
              strong: ({ children }) => <strong className="md-strong">{children}</strong>,
              h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
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
