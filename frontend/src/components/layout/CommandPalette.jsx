import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { Dialog, Icon } from '../ui';
import { buildPaletteItems, filterPaletteItems } from './paletteItems';
import './palette.css';

function PaletteBody({ onClose }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const listId = useId();
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => filterPaletteItems(buildPaletteItems(isAdmin), query), [isAdmin, query]);
  const current = Math.min(active, results.length - 1);
  const optionId = (index) => `${listId}-${index}`;

  useEffect(() => {
    listRef.current?.children[current]?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  const go = (item) => {
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); go(results[current]); }
  };

  return (
    <>
      <input
        className="ui-input palette__input"
        type="text"
        role="combobox"
        aria-label="Search pages"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results.length ? optionId(current) : undefined}
        aria-autocomplete="list"
        placeholder="Search pages"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
      />
      <ul id={listId} ref={listRef} className="palette__list" role="listbox" aria-label="Pages">
        {results.map((item, index) => (
          <li
            key={item.to}
            id={optionId(index)}
            role="option"
            aria-selected={index === current}
            className="palette__option"
            onMouseMove={() => setActive(index)}
            onClick={() => go(item)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            <span className="palette__group">{item.group}</span>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="palette__empty" role="status">No pages match "{query}".</p>}
    </>
  );
}

/** Jump to any page from the keyboard. The body only mounts while open, so each visit starts fresh. */
export default function CommandPalette({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} title="Quick navigation">
      <PaletteBody onClose={onClose} />
    </Dialog>
  );
}
