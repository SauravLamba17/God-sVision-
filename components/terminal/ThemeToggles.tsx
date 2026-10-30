'use client';
import { useTheme } from '@/lib/context/ThemeContext';

// Dark/Light segmented toggle + High contrast toggle (TopBar and /settings).
// Below 1280px only the icons show; aria-label keeps each name.
export default function ThemeToggles() {
  const { theme, contrast, setTheme, setContrast } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div role="group" aria-label="Theme" className="gv-seg">
        <button type="button" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾<span className="gv-hide-narrow"> Dark</span></button>
        <button type="button" aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀<span className="gv-hide-narrow"> Light</span></button>
      </div>
      <button
        type="button"
        className="gv-seg-single"
        aria-label="High contrast"
        aria-pressed={contrast === 'high'}
        onClick={() => setContrast(contrast === 'high' ? 'normal' : 'high')}
        title="High contrast: pure black or white, bolder text, ▲/▼ on every move"
      >
        ◐<span className="gv-hide-narrow">High contrast</span>
      </button>
    </div>
  );
}
