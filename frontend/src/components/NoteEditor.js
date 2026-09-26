import React, { useState } from 'react';
import './NoteEditor.css';

const MAX_NOTE_LENGTH = 20000;

export default function NoteEditor({ initialValue = '', onSave, onClose, placeholder, title }) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const dirty = draft !== initialValue;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await onSave(draft);
      setStatus('saved');
    } catch (err) {
      setStatus(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape' && !dirty) onClose?.();
  };

  return (
    <div className="note-editor" onClick={(e) => e.stopPropagation()}>
      {title && <div className="note-editor-title">{title}</div>}
      <textarea
        className="note-editor-textarea"
        value={draft}
        maxLength={MAX_NOTE_LENGTH}
        placeholder={placeholder}
        onChange={(e) => { setDraft(e.target.value); setStatus(null); }}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <div className="note-editor-footer">
        <span className="note-editor-meta">
          {status === 'saved' && !dirty ? '✓ Saved' : status && status !== 'saved' ? `⚠️ ${status}` : `${draft.length} / ${MAX_NOTE_LENGTH} · ⌘/Ctrl + Enter to save`}
        </span>
        <div className="note-editor-actions">
          <button type="button" className="note-btn" onClick={onClose}>Close</button>
          <button type="button" className="note-btn note-btn--primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
