import React, { useState } from 'react';
import { Button, Icon } from './ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateTrackerNote } from '../services/api';
import { describeError } from '../utils/errors';
import { markdownComponents } from './markdownComponents';
import './MessageBubble.css'; // shared .md-* markdown styles used by the read-mode renderer below
import './NoteEditor.css';

const MAX_NOTE_LENGTH = 20000;

/**
 * A floating, dockable note panel: minimize collapses to just the header, maximize
 * enlarges it for comfortable writing/reading, close fully hides it. Notes are written/edited
 * as plain Markdown but shown rendered ("Read" mode) once saved, for comfortable long-form reading.
 * Also offers one-click AI generation (pattern recognition → brute force → optimal, pseudocode only),
 * warning first if it would overwrite existing content.
 */
export default function NoteEditor({
  initialValue = '', onSave, onClose, placeholder, title,
  sheetId, itemKey, itemType, contextTitle, difficulty, sectionTitle, language, noteSource,
}) {
  const [draft, setDraft] = useState(initialValue);
  const [mode, setMode] = useState(() => (initialValue.trim() ? 'read' : 'edit'));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const dirty = draft !== initialValue;
  const canGenerate = Boolean(sheetId && itemKey && itemType && contextTitle);

  const save = async (text = draft, source = 'manual') => {
    setSaving(true);
    setStatus(null);
    try {
      await onSave(text, source);
      setStatus('saved');
      if (text.trim()) setMode('read');
    } catch (err) {
      setStatus(describeError(err, 'Save failed'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const runGenerate = async () => {
    setConfirmOverwrite(false);
    setGenerating(true);
    setStatus(null);
    try {
      const notes = await generateTrackerNote(sheetId, itemKey, { itemType, title: contextTitle, difficulty, sectionTitle, language });
      setDraft(notes);
      await save(notes, 'ai');
    } catch (err) {
      setStatus(describeError(err, 'Failed to generate notes.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (draft.trim()) setConfirmOverwrite(true);
    else runGenerate();
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape' && !dirty) onClose?.();
  };

  return (
    <div
      className={`note-editor ${maximized ? 'note-editor--maximized' : ''} ${minimized ? 'note-editor--minimized' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {maximized && <div className="note-editor-backdrop" onClick={() => setMaximized(false)} />}
      <div className="note-editor-panel">
        <div className="note-editor-header" onClick={() => minimized && setMinimized(false)}>
          <span className="note-editor-title">
            {title}
            {noteSource === 'ai' && !dirty && <span className="note-editor-ai-badge"><Icon name="sparkles" size={12} /> AI</span>}
          </span>
          <div className="note-editor-window-controls">
            <button
              type="button"
              className="note-win-btn note-win-btn--wide"
              title={mode === 'read' ? 'Switch to edit mode' : 'Switch to read mode'}
              onClick={(e) => { e.stopPropagation(); setMode((m) => (m === 'read' ? 'edit' : 'read')); }}
            >
              {mode === 'read' ? <><Icon name="edit" size={14} /> Edit</> : <><Icon name="eye" size={14} /> Read</>}
            </button>
            <button type="button" className="note-win-btn" title={minimized ? 'Restore' : 'Minimize'} onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}>
              {minimized ? '▢' : '—'}
            </button>
            <button type="button" className="note-win-btn" title={maximized ? 'Restore' : 'Maximize'} onClick={(e) => { e.stopPropagation(); setMaximized((m) => !m); }}>
              {maximized ? '⤡' : '⤢'}
            </button>
            <button type="button" className="note-win-btn note-win-btn--close" title="Close" onClick={(e) => { e.stopPropagation(); onClose?.(); }}>
              ×
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {mode === 'read' ? (
              <div className="note-editor-reading" onDoubleClick={() => setMode('edit')}>
                {draft.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{draft}</ReactMarkdown>
                ) : (
                  <p className="note-editor-empty">Nothing here yet — click Edit or Generate with AI.</p>
                )}
              </div>
            ) : (
              <textarea
                className="note-editor-textarea"
                value={draft}
                maxLength={MAX_NOTE_LENGTH}
                placeholder={placeholder}
                onChange={(e) => { setDraft(e.target.value); setStatus(null); }}
                onKeyDown={handleKeyDown}
                disabled={generating}
                autoFocus
              />
            )}
            {confirmOverwrite && (
              <div className="note-confirm-overlay">
                <div className="note-confirm-card">
                  <p>This will replace your current notes with AI-generated ones. Your existing text will be lost.</p>
                  <div className="note-confirm-actions">
                    <Button variant="secondary" size="sm" onClick={() => setConfirmOverwrite(false)}>Cancel</Button>
                    <Button size="sm" onClick={runGenerate}>Replace with AI notes</Button>
                  </div>
                </div>
              </div>
            )}
            <div className="note-editor-footer">
              <span className="note-editor-meta">
                {generating
                  ? 'Generating…'
                  : status === 'saved' ? '✓ Saved' : status ? status : mode === 'edit' ? `${draft.length} / ${MAX_NOTE_LENGTH} · ⌘/Ctrl + Enter to save` : 'Rendered Markdown · double-click to edit'}
              </span>
              <div className="note-editor-actions">
                {canGenerate && (
                  <Button variant="secondary" size="sm" icon="sparkles" onClick={handleGenerateClick} disabled={generating || saving}>
                    Generate with AI
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {mode === 'edit' && (
                  <Button size="sm" loading={saving} onClick={() => save()} disabled={generating || !dirty}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

