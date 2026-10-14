import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';
import { Icon } from '../ui';
import Avatar from './Avatar';
import QuotaMeter from './QuotaMeter';
import { ADMIN_ITEMS } from './navItems';

/** Account actions shared by the sidebar popover and the phone "More" sheet. */
export default function AccountMenuItems({ onDone }) {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const go = (to) => {
    onDone?.();
    navigate(to);
  };

  const signOut = async () => {
    onDone?.();
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-menu" role="menu">
      <div className="app-menu__user">
        <Avatar user={user} size={36} />
        <div className="app-menu__who">
          <strong>{user?.displayName || user?.email?.split('@')[0]}</strong>
          <span>{user?.email}</span>
        </div>
      </div>

      <QuotaMeter />

      <div className="app-menu__list">
        {isAdmin && ADMIN_ITEMS.map((item) => (
          <button key={item.to} type="button" role="menuitem" className="app-menu__item" onClick={() => go(item.to)}>
            <Icon name={item.icon} size={17} />
            {item.label}
          </button>
        ))}
        <button type="button" role="menuitem" className="app-menu__item" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        </button>
        <button type="button" role="menuitem" className="app-menu__item app-menu__item--danger" onClick={signOut}>
          <Icon name="logout" size={17} />
          Sign out
        </button>
      </div>
    </div>
  );
}
