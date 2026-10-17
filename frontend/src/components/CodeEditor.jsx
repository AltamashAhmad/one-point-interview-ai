import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui';
import { monacoLanguage } from '../utils/constants';
import './CodeEditor.css';

const SAVE_DELAY_MS = 1200;
// Only holds edits the server hasn't confirmed yet, so closing the tab mid-save loses nothing.
const pendingKey = (id) => `code_${id}`;

function readPending(id) {
  try { return localStorage.getItem(pendingKey(id)); } catch { return null; }
}

function writePending(id, code) {
  try {
    if (code === null) localStorage.removeItem(pendingKey(id));
    else localStorage.setItem(pendingKey(id), code);
  } catch { /* storage disabled: the server copy is still saved */ }
}

const SAVE_LABELS = { saved: 'Saved', saving: 'Saving…', unsaved: 'Not saved yet' };

/**
 * The server copy (`initialCode`, saved through `onSave`) is the source of truth, so the code follows
 * the candidate to another tab or device. Remount (key) per session.
 */
export default function CodeEditor({ sessionId, initialCode = '', language = 'javascript', onSubmitCode, onSave, isSubmitting = false, readOnly = false }) {
  // Starts from real code, never literal "starter" text; the hint below is an overlay.
  const [code, setCode] = useState(() => readPending(sessionId) ?? initialCode ?? '');
  const [saveState, setSaveState] = useState('saved');
  const latestRef = useRef(code);
  const timerRef = useRef(null);
  const langKey = monacoLanguage(language);

  const save = useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!onSave) return;
    const value = latestRef.current;
    setSaveState('saving');
    try {
      await onSave(value);
      if (latestRef.current === value) {
        writePending(sessionId, null);
        setSaveState('saved');
      }
    } catch {
      setSaveState('unsaved');
    }
  }, [onSave, sessionId]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    // Edits left unsaved on this device last time are pushed now.
    if (latestRef.current !== (initialCode || '')) {
      setSaveState('unsaved');
      saveRef.current();
    }
    return () => { if (timerRef.current) saveRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pushes unsent edits when the tab is hidden or closed, not only after the typing pause.
  useEffect(() => {
    const flush = () => { if (timerRef.current) saveRef.current(); };
    const flushWhenHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const handleEditorChange = (value = '') => {
    setCode(value);
    latestRef.current = value;
    writePending(sessionId, value);
    setSaveState('unsaved');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveRef.current(), SAVE_DELAY_MS);
  };

  const handleSubmit = () => {
    if (onSubmitCode && code.trim()) {
      onSubmitCode(code, langKey);
    }
  };

  return (
    <div className="code-editor">
      <div className="code-editor__bar">
        <div className="code-editor__meta">
          <div className="code-editor__lang">
            {langKey}
          </div>
          {onSave && (
            <span role="status" className="code-editor__status">{SAVE_LABELS[saveState]}</span>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || readOnly || !code.trim()}
        >
          {isSubmitting ? 'Reviewing...' : 'Submit for review'}
        </Button>
      </div>
      
      <div className="code-editor__body">
        {!code && (
          <div aria-hidden="true" className="code-editor__hint">
            // Write your {langKey} code here…
          </div>
        )}
        <Editor
          height="100%"
          language={langKey}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            readOnly,
          }}
        />
      </div>
    </div>
  );
}
