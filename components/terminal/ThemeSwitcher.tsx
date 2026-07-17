'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/lib/context/ThemeContext';
import { ThemeName } from '@/lib/themes';

const THEME_OPTIONS: Array<{
  id: ThemeName;
  label: string;
  icon: string;
  desc: string;
  colors: string[];
}> = [
  { id: 'dark',          label: 'Dark',          icon: '🌙', desc: '',                      colors: ['var(--bg-terminal)', 'var(--bg-terminal)', 'var(--text-accent)'] },
  { id: 'dark-contrast', label: 'High Contrast',  icon: 'â¬›', desc: 'Maximum accessibility', colors: ['var(--bg-terminal)', '#0a0a0a', '#ff8c00'] },
  { id: 'light',         label: 'Light',          icon: '☀️', desc: 'Clean daytime theme',   colors: ['#f0f4f0', '#ffffff', '#cc4400'] },
  { id: 'system',        label: 'System',         icon: '💻', desc: 'Follows your OS',       colors: ['#1a1a1a', '#f0f4f0', 'var(--text-muted)'] },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const updatePos = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  const handleToggle = () => {
    if (!open) updatePos();
    setOpen(p => !p);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insideDrop = dropRef.current?.contains(target);
      if (!insideBtn && !insideDrop) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  const active = THEME_OPTIONS.find(o => o.id === theme) ?? THEME_OPTIONS[0];

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        right: dropPos.right,
        width: 230,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-accent)',
        borderRadius: 4,
        zIndex: 99999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        fontFamily: 'IBM Plex Mono, monospace',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '6px 10px 5px',
        borderBottom: '1px solid var(--border-dim)',
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'var(--text-accent)',
        background: 'var(--bg-header)',
      }}>
        SELECT THEME
      </div>

      {THEME_OPTIONS.map(opt => {
        const isActive = theme === opt.id;
        return (
          <div
            key={opt.id}
            onClick={() => { setTheme(opt.id); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', cursor: 'pointer',
              borderLeft: isActive ? '3px solid var(--border-accent)' : '3px solid transparent',
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              borderBottom: '1px solid var(--border-dim)',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>{opt.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                {opt.label}
                {isActive && <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--text-accent)' }}>✓ ACTIVE</span>}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {opt.colors.map((c, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: '1px solid rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ padding: '5px 10px', fontSize: 8, color: 'var(--text-muted)', background: 'var(--bg-header)' }}>
        Theme saved automatically
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: open ? 'var(--bg-hover)' : 'transparent',
          border: `1px solid ${open ? 'var(--border-accent)' : 'var(--border-dim)'}`,
          borderRadius: 3, padding: '2px 8px',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 9,
          color: open ? 'var(--text-accent)' : 'var(--text-muted)',
          cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap',
          transition: 'all 150ms ease',
        }}
      >
        <span>{active.icon}</span>
        <span>THEME</span>
        <span style={{ fontSize: 7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {dropdown}
    </>
  );
}
