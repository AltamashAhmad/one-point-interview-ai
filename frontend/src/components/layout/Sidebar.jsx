import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { Icon } from '../ui';
import Avatar from './Avatar';
import AccountMenuItems from './AccountMenuItems';
import { NAV_GROUPS } from './navItems';
import './palette.css';

const SHORTCUT = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '') ? '\u2318 K' : 'Ctrl K';

export default function Sidebar({ onSearch }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const footerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => { if (!footerRef.current?.contains(e.target)) setOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <aside className="app-sidebar" aria-label="Primary">
      <Link to="/" className="app-brand">
        <span className="app-brand__mark"><Icon name="target" size={18} strokeWidth={2} /></span>
        <span className="app-brand__name">OnePoint<span> AI</span></span>
      </Link>

      {onSearch && (
        <button type="button" className="app-search" onClick={onSearch} aria-label="Search pages" aria-keyshortcuts="Control+K Meta+K">
          <Icon name="search" size={16} />
          Search
          <kbd className="app-search__hint" aria-hidden="true">{SHORTCUT}</kbd>
        </button>
      )}

      <nav className="app-nav" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="app-nav__group">
            {group.label && <span className="app-nav__label">{group.label}</span>}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer" ref={footerRef}>
        {open && (
          <div className="app-popover">
            <AccountMenuItems onDone={() => setOpen(false)} />
          </div>
        )}
        <button
          type="button"
          className="app-account"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Avatar user={user} />
          <span className="app-account__who">
            <strong>{user?.displayName || user?.email?.split('@')[0] || 'Account'}</strong>
            <span>{user?.email}</span>
          </span>
          <Icon name="chevronDown" size={16} className={`app-account__chevron${open ? ' is-open' : ''}`} />
        </button>
      </div>
    </aside>
  );
}
