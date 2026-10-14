import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../ui';
import AccountMenuItems from './AccountMenuItems';
import { TAB_ITEMS } from './navItems';

/** Phone navigation: four destinations plus a "More" sheet that holds account actions. */
export default function MobileTabBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      {open && (
        <>
          <div className="app-sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="app-sheet" role="dialog" aria-label="Account">
            <AccountMenuItems onDone={() => setOpen(false)} />
          </div>
        </>
      )}
      <nav className="app-tabbar" aria-label="Main">
        {TAB_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `app-tab${isActive ? ' is-active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`app-tab${open ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="menu" size={21} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
