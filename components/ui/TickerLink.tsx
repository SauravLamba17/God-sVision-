'use client';
import { useLinkedPanel } from '@/lib/context/LinkedPanelContext';

interface TickerLinkProps {
  ticker: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function TickerLink({ ticker, children, className, style }: TickerLinkProps) {
  const { setActiveTicker } = useLinkedPanel();

  return (
    <span
      className={className}
      onClick={() => setActiveTicker(ticker)}
      style={{
        color: 'var(--text-accent)',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'opacity 0.15s',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      title={`Link panels to ${ticker}`}
    >
      {children ?? ticker}
    </span>
  );
}
