import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Button, IconButton } from '../ui';
import './Composer.css';

// Grows the textarea to fit its text; the CSS max-height turns the excess into scrolling.
function fitHeight(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** Chat input: a growing text box with voice and send. Enter sends, Shift+Enter adds a line. */
export default function Composer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  placeholder,
  maxLength,
  disabled,
  sendDisabled,
  sending,
  voice,
  hint,
}) {
  const textareaRef = useRef(null);
  const { supported, listening, interim, error, onToggle, onStop } = voice;

  // The page keeps its own ref for focusing; sizing needs the same node here.
  const setTextarea = useCallback((node) => {
    textareaRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);

  useLayoutEffect(() => { fitHeight(textareaRef.current); }, [value]);

  useEffect(() => {
    const refit = () => fitHeight(textareaRef.current);
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);

  // Dictation stops as soon as the page stops accepting input (sent, ended, or busy).
  useEffect(() => {
    if (disabled && listening) onStop?.();
  }, [disabled, listening, onStop]);

  return (
    <footer className="composer">
      <div className="composer-box">
        <textarea
          ref={setTextarea}
          className="composer-input"
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          aria-label="Your answer"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
        />
        <div className="composer-toolbar">
          <div className="composer-status">
            {listening && (
              <>
                <span className="composer-live-dot" aria-hidden="true" />
                <span role="status">Listening</span>
                {interim && <span className="composer-interim" aria-hidden="true">{interim}</span>}
              </>
            )}
          </div>
          <div className="composer-actions">
            {supported && (
              <IconButton
                icon={listening ? 'stop' : 'mic'}
                label={listening ? 'Stop recording' : 'Start voice input'}
                className={listening ? 'composer-mic composer-mic--active' : 'composer-mic'}
                disabled={disabled && !listening}
                onClick={onToggle}
              />
            )}
            <Button
              variant="primary"
              icon="arrowUp"
              aria-label="Send message"
              className="composer-send"
              disabled={sendDisabled}
              loading={sending}
              onClick={onSend}
            />
          </div>
        </div>
      </div>
      {error && <p role="alert" className="composer-note">{error}</p>}
      <p className="composer-hint">{hint}</p>
    </footer>
  );
}
