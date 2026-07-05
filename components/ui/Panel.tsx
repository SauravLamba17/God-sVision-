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
