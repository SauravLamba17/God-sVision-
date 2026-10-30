'use client';
import { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  live?: boolean;
  timestamp?: string;
  children: ReactNode;
  action?: ReactNode;
  noPadding?: boolean;
  style?: React.CSSProperties;
}

export function Panel({ title, subtitle, live, timestamp, children, action, noPadding, style }: PanelProps) {
  return (
    <div className="gv-card" style={{
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      <div className="gv-card-head" style={{ flexShrink: 0, minHeight: 36, padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 'var(--fw-normal)', color: 'var(--text-muted)' }}>{subtitle}</span>
          )}
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--up-soft)', borderRadius: 20,
              padding: '1px 7px', border: 'var(--bw) solid var(--up)',
            }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 'var(--fw-bold)', color: 'var(--up)' }}>LIVE</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {action}
          {timestamp && (
            <span className="gv-num" style={{ fontSize: 'var(--fs-meta)', fontWeight: 'var(--fw-normal)', color: 'var(--text-muted)' }}>{timestamp}</span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', ...(noPadding ? {} : { padding: '12px 16px' }) }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Honest stand-in for a panel that has no data to show.
 *
 * A panel that returns null still occupies its grid cell, so the dashboard
 * renders a solid black rectangle with no header and no explanation. Every
 * panel whose fetch can come back empty renders this instead, so a cell is
 * never blank: it says which panel it is and why it has nothing.
 */
export function PanelEmpty({
  title, message = 'Data temporarily unavailable', accent = 'var(--text)', onRetry,
}: { title: string; message?: string; accent?: string; onRetry?: () => void }) {
  return (
    <div className="gv-card" style={{
      height: '100%', minHeight: 80,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      <div className="gv-card-head">
        <span style={{ color: accent }}>{title}</span>
      </div>
      <div style={{
        flex: 1, padding: 16, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center', gap: 6,
        fontSize: 'var(--fs-body)', color: 'var(--text-muted)',
      }}>
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="gv-tab">↻ Retry</button>
        )}
      </div>
    </div>
  );
}

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="gv-card-head" style={{ flexShrink: 0, minHeight: 36, padding: '8px 16px' }}>
      <span style={{ fontSize: 'var(--fs-header)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{title}</span>
      {children}
    </div>
  );
}
