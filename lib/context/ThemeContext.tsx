'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Two settings → four looks (tokens in app/globals.css):
//   dark + normal = Saffron Dark, light + normal = Saffron Light,
//   dark + high = Pure Black,     light + high = Pure White.
// The early script in app/layout.tsx sets both attributes before first paint;
// this provider only switches them. Nothing here writes colours.
export type ThemeName = 'dark' | 'light';
export type Contrast = 'normal' | 'high';

interface ThemeContextType {
  theme: ThemeName;
  contrast: Contrast;
  setTheme: (t: ThemeName) => void;
  setContrast: (c: Contrast) => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  contrast: 'normal',
  setTheme: () => {},
  setContrast: () => {},
  isDark: true,
  isLight: false,
});

const SCHEME_LIGHT = '(prefers-color-scheme: light)';
const CONTRAST_MORE = '(prefers-contrast: more)';

/** Saved choices, or null where the user hasn't picked (follow the OS). Same rules as the init script. */
function readSaved(): { theme: ThemeName | null; contrast: Contrast | null } {
  let t: string | null = null, c: string | null = null;
  try {
    t = localStorage.getItem('gv_theme'); c = localStorage.getItem('gv_contrast');
    // The old theme menu saved 'dark-contrast' (and 'system' = follow the OS): store it as the two settings.
    if (t === 'dark-contrast') {
      t = 'dark'; c = c ?? 'high';
      localStorage.setItem('gv_theme', t); localStorage.setItem('gv_contrast', c);
    }
  } catch { /* storage blocked */ }
  return {
    theme: t === 'dark' || t === 'light' ? t : null,
    contrast: c === 'normal' || c === 'high' ? c : null,
  };
}

const osTheme = (): ThemeName => (window.matchMedia(SCHEME_LIGHT).matches ? 'light' : 'dark');
const osContrast = (): Contrast => (window.matchMedia(CONTRAST_MORE).matches ? 'high' : 'normal');

/** A translucent tint of any colour (token or hex) for badge/row backgrounds; none in high contrast (--tint-k: 0).
 *  Replaces the old `${color}18` hex-alpha suffix, which is invalid CSS once the colour is a var(). */
export const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} calc(${percent}% * var(--tint-k)), transparent)`;

/** Current value of a design token, e.g. readToken('--up'), for canvas charts. */
export function readToken(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dark');
  const [contrast, setContrastState] = useState<Contrast>('normal');

  useEffect(() => {
    const root = document.documentElement;
    readSaved(); // migrates an old saved value
    setThemeState(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    setContrastState(root.getAttribute('data-contrast') === 'high' ? 'high' : 'normal');

    // Until the user picks, keep following the OS.
    const scheme = window.matchMedia(SCHEME_LIGHT);
    const more = window.matchMedia(CONTRAST_MORE);
    const onScheme = () => {
      if (readSaved().theme) return;
      const t = osTheme();
      root.setAttribute('data-theme', t);
      setThemeState(t);
    };
    const onContrast = () => {
      if (readSaved().contrast) return;
      const c = osContrast();
      root.setAttribute('data-contrast', c);
      setContrastState(c);
    };
    scheme.addEventListener('change', onScheme);
    more.addEventListener('change', onContrast);
    return () => { scheme.removeEventListener('change', onScheme); more.removeEventListener('change', onContrast); };
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    document.documentElement.setAttribute('data-theme', t);
    setThemeState(t);
    try { localStorage.setItem('gv_theme', t); } catch { /* storage blocked: applies for this visit only */ }
  }, []);

  const setContrast = useCallback((c: Contrast) => {
    document.documentElement.setAttribute('data-contrast', c);
    setContrastState(c);
    try { localStorage.setItem('gv_contrast', c); } catch { /* storage blocked: applies for this visit only */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, contrast, setTheme, setContrast, isDark: theme === 'dark', isLight: theme === 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
