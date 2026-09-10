'use client';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

const mono = 'IBM Plex Mono, monospace';

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggleMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(prev => !prev);
  };

  const initials = session?.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? session?.user?.email?.[0]?.toUpperCase() ?? '?';

  if (status === 'loading') return null;

  if (!session) {
    return (
      <Link href="/auth/signin" style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px',
        background: 'transparent', border: '1px solid var(--border-color)',
        color: 'var(--text-muted)', fontFamily: mono, fontSize: 'var(--fs-meta)',
        letterSpacing: '0.06em', textDecoration: 'none', borderRadius: 2,
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--text-accent)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
      >
        SIGN IN
      </Link>
    );
  }

  const dropdown = open && mounted && createPortal(
    <div style={{
      position: 'fixed', top: pos.top, right: pos.right,
      width: 200, background: 'var(--bg-panel)',
      border: '1px solid var(--border-color)', borderTop: '2px solid var(--text-accent)',
      zIndex: 9999, fontFamily: mono,
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
    }}>
      {/* User info */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>{session.user?.name}</div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>{session.user?.email}</div>
      </div>

      {/* Menu items */}
      {[
        { label: 'PORTFOLIO', href: '/portfolio' },
        { label: 'ALERTS', href: '/alerts' },
        { label: 'SETTINGS', href: '/settings' },
      ].map(item => (
        <Link key={item.href} href={item.href}
          onClick={() => setOpen(false)}
          style={{
            display: 'block', padding: '7px 12px', fontSize: 'var(--fs-body)',
            color: 'var(--text-muted)', textDecoration: 'none',
            borderBottom: '1px solid var(--border-dim)',
            letterSpacing: '0.06em', transition: 'all 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
        >
          {item.label}
        </Link>
      ))}

      <button onClick={() => { setOpen(false); signOut({ callbackUrl: '/' }); }} style={{
        display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left',
        fontSize: 'var(--fs-body)', color: 'var(--text-muted)', background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: mono, letterSpacing: '0.06em', transition: 'all 0.1s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-negative)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        SIGN OUT
      </button>
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleMenu}
        title={session.user?.email ?? ''}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-muted)',
          fontFamily: mono, fontSize: 'var(--fs-meta)', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: 0, flexShrink: 0,
        }}
      >
        {initials}
      </button>
      {dropdown}
    </>
  );
}
