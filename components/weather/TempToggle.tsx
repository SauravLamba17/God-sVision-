'use client';
import { useEffect, useState } from 'react';

export type TempUnit = 'C' | 'F';

interface TempToggleProps {
  unit?: TempUnit;
  onChange?: (unit: TempUnit) => void;
  /** If true, reads/writes gv_temp_unit from localStorage automatically */
  standalone?: boolean;
}

export default function TempToggle({ unit: externalUnit, onChange, standalone = false }: TempToggleProps) {
  const [internalUnit, setInternalUnit] = useState<TempUnit>('C');

  useEffect(() => {
    if (!standalone) return;
    try {
      const saved = localStorage.getItem('gv_temp_unit') as TempUnit | null;
      if (saved === 'C' || saved === 'F') setInternalUnit(saved);
    } catch { /* ignore */ }
  }, [standalone]);

  const activeUnit = standalone ? internalUnit : (externalUnit ?? 'C');

  const handleChange = (u: TempUnit) => {
    if (standalone) {
      setInternalUnit(u);
      try { localStorage.setItem('gv_temp_unit', u); } catch { /* ignore */ }
    }
    onChange?.(u);
  };

  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-header)',
      border: '1px solid var(--border-dim)',
      borderRadius: 20,
      padding: 2,
      gap: 2,
      flexShrink: 0,
    }}>
      {(['C', 'F'] as TempUnit[]).map(u => (
        <button
          key={u}
          onClick={() => handleChange(u)}
          style={{
            background: activeUnit === u ? 'var(--text-accent)' : 'transparent',
            color: activeUnit === u ? '#000' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 16,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'IBM Plex Mono, monospace',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            letterSpacing: '0.05em',
          }}
        >
          °{u}
        </button>
      ))}
    </div>
  );
}

/** Utility: convert Celsius to the given unit */
export function convertTemp(celsius: number, unit: TempUnit): number {
  return unit === 'F' ? Math.round(celsius * 9 / 5 + 32) : Math.round(celsius);
}

/** Utility: convert Fahrenheit to the given unit */
export function convertTempF(fahrenheit: number, unit: TempUnit): number {
  return unit === 'C' ? Math.round((fahrenheit - 32) * 5 / 9) : Math.round(fahrenheit);
}
