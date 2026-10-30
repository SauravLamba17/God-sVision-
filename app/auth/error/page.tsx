'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const font = 'var(--font-sans), system-ui, sans-serif'; // UI font (tokens: app/globals.css)

const messages: Record<string, string> = {
  Configuration: 'Server configuration error. Contact support.',
  AccessDenied: 'Access denied. You do not have permission.',
  Verification: 'Verification link is invalid or has expired.',
  Default: 'Authentication failed. Please try again.',
};

function AuthErrorContent() {
  const params = useSearchParams();
  const error = params.get('error');
  return (
    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 20 }}>
      {messages[error || 'Default'] ?? messages.Default}
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: 360, background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderTop: 'var(--stripe) solid var(--down)', borderRadius: 'var(--radius)', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--down)', letterSpacing: '0.08em', marginBottom: 8 }}>AUTH ERROR</div>
        <Suspense fallback={<div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 20 }}>Authentication failed. Please try again.</div>}>
          <AuthErrorContent />
        </Suspense>
        <Link href="/auth/signin" style={{
          display: 'inline-block', padding: '8px 20px',
          background: 'var(--accent)', color: 'var(--on-accent)', textDecoration: 'none',
          fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          borderRadius: 'var(--radius-inner)',
        }}>
          ← TRY AGAIN
        </Link>
      </div>
    </div>
  );
}
