import React from 'react';
import { useTheme } from '../contexts/useTheme';
import { Icon } from './ui';
import './ThemeToggle.css';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">{isDark ? <Icon name="moon" size={14} /> : <Icon name="sun" size={14} />}</span>
      </span>
    </button>
  );
}
