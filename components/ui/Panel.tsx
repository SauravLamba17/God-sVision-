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
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-header)',
        flexShrink: 0,
        minHeight: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-accent)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{subtitle}</span>
          )}
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-live)', borderRadius: 20,
              padding: '1px 7px', border: '1px solid rgba(0,230,118,0.2)',
            }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 8, fontWeight: 700,
                color: 'var(--text-positive)',
              }}>LIVE</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {action}
          {timestamp && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9, color: 'var(--text-muted)',
            }}>{timestamp}</span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', ...(noPadding ? {} : { padding: '8px 12px' }) }}>
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
  title, message = 'Data temporarily unavailable', accent = 'var(--text-muted)', onRetry,
}: { title: string; message?: string; accent?: string; onRetry?: () => void }) {
  return (
    <div style={{
      border: '1px solid var(--border-color)', borderLeft: `2px solid ${accent}`,
      background: 'var(--bg-panel)', height: '100%', minHeight: 80,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-header)' }}>
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', fontWeight: 600,
          color: accent, letterSpacing: '0.08em',
        }}>{title}</span>
      </div>
      <div style={{
        flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center', gap: 6,
        fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: 'var(--text-muted)',
      }}>
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} style={{
            background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-meta)', padding: '2px 8px',
            borderRadius: 2, cursor: 'pointer',
          }}>↻ RETRY</button>
        )}
      </div>
    </div>
  );
}

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 12px',
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--bg-header)',
      flexShrink: 0, minHeight: 32,
    }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, fontWeight: 700,
        color: 'var(--text-accent)', letterSpacing: '0.5px', textTransform: 'uppercase',
      }}>{title}</span>
      {children}
    </div>
  );
}
