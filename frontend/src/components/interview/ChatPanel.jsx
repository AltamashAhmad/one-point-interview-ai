import React from 'react';
import MessageBubble from '../MessageBubble';
import TypingIndicator from '../TypingIndicator';
import { Badge, Button, Icon } from '../ui';
import './ChatPanel.css';

const difficultyLabel = (difficulty) => (!difficulty || difficulty === 'ANY' ? 'Any difficulty' : difficulty);

/** Error message with an optional retry. Also used above the setup screen. */
export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="interview-error" role="alert">
      <Icon name="alert" size={16} />
      <span>{error.message}</span>
      {error.retry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/** Scrollable transcript with session facts, status notices and errors. */
export default function ChatPanel({
  sessionConfig,
  showDifficulty,
  messages,
  typeColor,
  notices,
  typing,
  endingText,
  archivedText,
  onStartNew,
  error,
  onRetry,
  endRef,
}) {
  return (
    <div className="chat-scroll">
      <div className="chat-feed">
        {sessionConfig && (
          <div className="chat-meta">
            {sessionConfig.company && (
              <Badge><Icon name="building" size={14} />{sessionConfig.company}</Badge>
            )}
            {showDifficulty && (
              <Badge><Icon name="target" size={14} />{difficultyLabel(sessionConfig.difficulty)}</Badge>
            )}
            {sessionConfig.language && (
              <Badge><Icon name="code" size={14} />{sessionConfig.language}</Badge>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          msg.streaming && !msg.content
            ? null
            : <MessageBubble key={i} message={msg} typeColor={typeColor} />
        ))}

        {notices.map((text) => <p key={text} className="chat-notice" role="status">{text}</p>)}
        {typing && <TypingIndicator />}
        {endingText && <p className="chat-notice" role="status">{endingText}</p>}
        {archivedText && (
          <p className="chat-notice" role="status">
            {archivedText}{' '}
            <Button variant="ghost" size="sm" onClick={onStartNew}>Start a new one</Button>
          </p>
        )}
        <ErrorBanner error={error} onRetry={onRetry} />
        <div ref={endRef} />
      </div>
    </div>
  );
}
