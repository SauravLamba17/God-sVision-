'use client';
import { useEffect, useRef, useState } from 'react';
import { useLinkedPanel } from '@/lib/context/LinkedPanelContext';

const mono = 'IBM Plex Mono, monospace';

export default function TickerBroadcast() {
  const { activeTicker } = useLinkedPanel();
  const [visible, setVisible] = useState(false);
  const prevRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (activeTicker && activeTicker !== prevRef.current) {
      prevRef.current = activeTicker;
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
      background: 'var(--bg-panel)',
      border: '1px solid var(--text-accent)',
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
