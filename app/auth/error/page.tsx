'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const mono = 'IBM Plex Mono, monospace';

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
    <div style={{ fontSize: 11, color: '#88aa88', marginBottom: 20 }}>
      {messages[error || 'Default'] ?? messages.Default}
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono }}>
      <div style={{ width: 360, background: '#050a05', border: '1px solid #330000', borderTop: '2px solid #ff1744', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#ff1744', letterSpacing: '0.08em', marginBottom: 8 }}>AUTH ERROR</div>
        <Suspense fallback={<div style={{ fontSize: 11, color: '#88aa88', marginBottom: 20 }}>Authentication failed. Please try again.</div>}>
          <AuthErrorContent />
        </Suspense>
        <Link href="/auth/signin" style={{
          display: 'inline-block', padding: '8px 20px',
          background: '#ff6d00', color: '#000', textDecoration: 'none',
          fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          borderRadius: 2,
        }}>
          ← TRY AGAIN
        </Link>
      </div>
    </div>
  );
}
