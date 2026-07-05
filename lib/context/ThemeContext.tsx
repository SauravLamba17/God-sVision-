'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { THEMES, ThemeName, getThemeVars } from '@/lib/themes';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  isDark: boolean;
  isLight: boolean;
  currentVars: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  isDark: true,
  isLight: false,
  currentVars: THEMES.dark.vars,
});

function applyThemeToDOM(themeName: ThemeName) {
  if (typeof window === 'undefined') return;

  const vars = getThemeVars(themeName);
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  const resolved = themeName === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeName;
  root.setAttribute('data-theme', resolved);

  document.body.style.backgroundColor = vars['--bg-terminal'] ?? '#000000';
  document.body.style.color = vars['--text-primary'] ?? '#c8e6c9';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gv_theme') as ThemeName | null;
      const valid: ThemeName[] = ['dark', 'light', 'dark-contrast', 'system'];
      const initial: ThemeName = (saved && valid.includes(saved)) ? saved : 'dark';
      setThemeState(initial);
      applyThemeToDOM(initial);
    } catch {
      applyThemeToDOM('dark');
    }
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeToDOM('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    try { localStorage.setItem('gv_theme', newTheme); } catch { /* ignore */ }
    applyThemeToDOM(newTheme);
  }, []);

  const resolved = theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const currentVars = getThemeVars(theme);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      isDark: resolved === 'dark' || resolved === 'dark-contrast',
      isLight: resolved === 'light',
      currentVars,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
