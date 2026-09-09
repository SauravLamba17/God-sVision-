'use client';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-terminal)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      <div style={{
        textAlign: 'center',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '40px 48px',
        background: 'var(--bg-panel)',
        maxWidth: '480px',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '8px' }}>
          ⚡ GOD's VISION
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
          Currently FREE for all users
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', lineHeight: 1.7 }}>
          All features including AI Analysis, India Mode,<br />
          Analyst Panel, Portfolio and Alerts are free<br />
          during our launch period.
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.7 }}>
          Paid plans coming soon.<br />
          Bloomberg charges $32,000/year.<br />
          We will charge significantly less.
        </div>
        <Link href="/dashboard" style={{
          display: 'inline-block',
          padding: '10px 24px',
          background: 'var(--text-accent)',
          color: '#000',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '1px',
          textDecoration: 'none',
          borderRadius: '3px',
        }}>
          ← BACK TO TERMINAL
        </Link>
      </div>
    </div>
  );
}
