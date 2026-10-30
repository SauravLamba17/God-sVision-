'use client';
import { useEffect, useRef, useState } from 'react';
import { useLinkedPanel } from '@/lib/context/LinkedPanelContext';

const mono = 'var(--font-mono), ui-monospace, monospace'; // the broadcast shows a ticker symbol

export default function TickerBroadcast() {
  const { activeTicker } = useLinkedPanel();
  const [visible, setVisible] = useState(false);
  const prevRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (activeTicker && activeTicker !== prevRef.current) {
      const isInitial = prevRef.current === '';
      prevRef.current = activeTicker;
      // Only announce real changes — the default ticker on first mount flashed
      // "LINKED PANELS → AAPL" on every page load, sign-in page included.
      if (isInitial) return;
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 1500);
    }
    return () => clearTimeout(timerRef.current);
  }, [activeTicker]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 72, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9000, pointerEvents: 'none',
      background: 'var(--surface)',
      border: 'var(--bw) solid var(--accent)',
      borderRadius: 'var(--radius-inner)',
      padding: '4px 14px',
      fontFamily: mono, fontSize: 'var(--fs-body)', fontWeight: 700,
      color: 'var(--text-accent)', letterSpacing: '0.1em',
      animation: 'fadeInOut 1.5s ease forwards',
      whiteSpace: 'nowrap',
    }}>
      ⧉ LINKED PANELS → {activeTicker}
    </div>
  );
}
