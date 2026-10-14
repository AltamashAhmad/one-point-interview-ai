import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeContext } from './useTheme';
import { useAuth } from './useAuth';
import { updateMyPreferences } from '../services/api';

const STORAGE_KEY = 'opi_theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const { userProfile } = useAuth();
  const [localTheme] = useState(getInitialTheme);
  // A choice made this session wins; otherwise the account's saved theme, then this device's last one.
  const [chosen, setChosen] = useState(null);
  const theme = chosen ?? userProfile?.preferences?.theme ?? localTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setChosen(next);
    if (userProfile) updateMyPreferences({ theme: next }).catch(() => {});
  }, [userProfile]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
