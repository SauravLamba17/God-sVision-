'use client';
import { useEffect, useState } from 'react';

const mono = 'IBM Plex Mono, monospace';

export default function ResetPasswordPage() {
  // Read ?token= from the URL directly rather than useSearchParams(), which
  // would force this page behind a Suspense boundary at build time.
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return; }
      setDone(true); setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong'); setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0a140a', border: '1px solid #1b2e1b',
    color: '#c8e6c9', fontFamily: mono, fontSize: 12, padding: '8px 12px',
    borderRadius: 2, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: mono,
    }}>
      <div style={{ width: 380, background: '#050a05', border: '1px solid #1b2e1b', borderTop: '2px solid #ff6d00', padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, color: '#ff6d00', fontWeight: 700, letterSpacing: '0.12em' }}>⚡ GOD'S VISION</div>
          <div style={{ fontSize: 9, color: '#607d8b', letterSpacing: '0.2em', marginTop: 4 }}>SET A NEW PASSWORD</div>
        </div>

        {done ? (
          <>
            <div style={{ padding: '10px 12px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', fontSize: 11, borderRadius: 2, lineHeight: 1.6, marginBottom: 14 }}>
              Password updated. You can now sign in with your new password.
            </div>
            <a
              href="/auth/signin"
              style={{
                display: 'block', textAlign: 'center', padding: '10px 0',
                background: '#ff6d00', color: '#000', fontFamily: mono, fontSize: 11,
                fontWeight: 700, letterSpacing: '0.1em', borderRadius: 2, textDecoration: 'none',
              }}
            >
              GO TO SIGN IN →
            </a>
          </>
        ) : token === '' ? (
          <div style={{ padding: '10px 12px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#ff1744', fontSize: 11, borderRadius: 2, lineHeight: 1.6 }}>
            This reset link is missing its token. <a href="/auth/forgot-password" style={{ color: '#ff6d00' }}>Request a new reset link</a>.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: '#607d8b', marginBottom: 4, letterSpacing: '0.08em' }}>NEW PASSWORD</div>
                <input
                  style={inputStyle}
                  type="password" value={password} placeholder="Min 8 characters" required
                  onChange={e => setPassword(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#ff6d00')}
                  onBlur={e => (e.target.style.borderColor = '#1b2e1b')}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#607d8b', marginBottom: 4, letterSpacing: '0.08em' }}>CONFIRM NEW PASSWORD</div>
                <input
                  style={inputStyle}
                  type="password" value={confirm} placeholder="••••••••" required
                  onChange={e => setConfirm(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#ff6d00')}
                  onBlur={e => (e.target.style.borderColor = '#1b2e1b')}
                />
              </div>

              {error && (
                <div style={{ padding: '6px 10px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#ff1744', fontSize: 10, borderRadius: 2, lineHeight: 1.5 }}>
                  {error} <a href="/auth/forgot-password" style={{ color: '#ff6d00' }}>Request a new reset link</a>.
                </div>
              )}

              <button
                type="submit" disabled={loading || token === null} aria-busy={loading}
                style={{
                  width: '100%', padding: '10px 0',
                  background: loading ? '#1b2e1b' : '#ff6d00', color: loading ? '#607d8b' : '#000',
                  border: 'none', fontFamily: mono, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer',
                  borderRadius: 2, transition: 'all 0.15s',
                }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="gv-spinner" aria-hidden="true" />
                    UPDATING…
                  </span>
                ) : 'SET NEW PASSWORD →'}
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1b2e1b' }}>
          <a href="/auth/signin" style={{ fontSize: 9, color: '#607d8b', textDecoration: 'none' }}>← Back to Sign In</a>
        </div>
      </div>
    </div>
  );
}
