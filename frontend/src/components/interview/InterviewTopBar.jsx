import React, { useEffect, useRef, useState } from 'react';
import { Button, Icon, IconButton } from '../ui';
import ModelSelector from '../ModelSelector';
import ThemeToggle from '../ThemeToggle';
import './InterviewTopBar.css';

/**
 * Header for the interview workspace. Session controls appear only while a session is live.
 * New session and End sit in the More menu; on phones the theme switch does too.
 */
export default function InterviewTopBar({
  config,
  title,
  questionLink,
  live,
  isMobile,
  clock,
  model,
  showCodeButton,
  codeDisabled,
  onOpenCode,
  endLabel,
  endBusy,
  endDisabled,
  onEnd,
  newSessionDisabled,
  onNewSession,
  onBack,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnPointer = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const closeOnEscape = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const fromMenu = (action) => () => { setMenuOpen(false); action(); };

  return (
    <header className="topbar">
      <div className="topbar__start">
        <Button variant="ghost" size="sm" icon="arrowLeft" aria-label="Back" className="topbar__back" onClick={onBack}>
          <span className="topbar__label">Back</span>
        </Button>
        <span className="topbar__divider" aria-hidden="true" />
        <div className="topbar__titles">
          <span className="topbar__type">
            <span className="topbar__dot" aria-hidden="true" />
            {config.label}{config.isTutor ? ' Session' : ' Interview'}
          </span>
          <span className="topbar__title">
            <span className="topbar__title-text">{title}</span>
            {questionLink && (
              <a href={questionLink} target="_blank" rel="noopener noreferrer" className="topbar__link" title="View on LeetCode" aria-label="View on LeetCode">
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </span>
        </div>
      </div>

      <div className="topbar__end">
        {live && clock && (
          <span
            className={['topbar-timer', clock.urgent && 'topbar-timer--urgent', clock.expired && 'topbar-timer--expired'].filter(Boolean).join(' ')}
            title={clock.title}
            role="timer"
            aria-live={clock.urgent ? 'polite' : 'off'}
          >
            <Icon name="clock" size={14} />
            {clock.label}
          </span>
        )}
        {live && (
          <div className="topbar-model">
            <ModelSelector selectedModel={model.value} onModelChange={model.onChange} disabled={model.disabled} />
          </div>
        )}
        {live && showCodeButton && (
          <Button variant="secondary" size="sm" icon="code" title="Open Code Editor" aria-label="Open code editor" disabled={codeDisabled} onClick={onOpenCode}>
            <span className="topbar__label">Code</span>
          </Button>
        )}
        {!isMobile && <ThemeToggle />}
        {(live || isMobile) && (
          <div className="topbar-menu" ref={menuRef}>
            <IconButton icon="more" label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} />
            {menuOpen && (
              <div className="topbar-menu__panel">
                {live && (
                  <>
                    <button type="button" className="topbar-menu__item" disabled={newSessionDisabled} onClick={fromMenu(onNewSession)}>
                      <Icon name="plus" size={16} />
                      New Session
                    </button>
                    <button type="button" className="topbar-menu__item topbar-menu__item--danger" disabled={endDisabled || endBusy} onClick={fromMenu(onEnd)}>
                      <Icon name="check" size={16} />
                      {endLabel}
                    </button>
                  </>
                )}
                {isMobile && (
                  <div className="topbar-menu__row">
                    <span>Theme</span>
                    <ThemeToggle />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
