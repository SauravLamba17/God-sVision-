'use client';
import { useEffect, useState } from 'react';

const font = 'var(--font-sans), system-ui, sans-serif'; // UI font (tokens: app/globals.css)

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
    width: '100%', background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
    color: 'var(--text)', fontFamily: font, fontSize: 12, padding: '8px 12px',
    borderRadius: 2, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: font,
    }}>
      <div style={{ width: 380, background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderTop: 'var(--stripe) solid var(--stripe-color)', borderRadius: 'var(--radius)', padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, color: 'var(--text)', fontWeight: 700 }}>GOD&apos;s <span style={{ color: 'var(--accent-text)' }}>Vision</span></div>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.2em', marginTop: 4 }}>SET A NEW PASSWORD</div>
        </div>

        {done ? (
          <>
            <div style={{ padding: '10px 12px', background: 'var(--up-soft)', border: 'var(--bw) solid var(--up)', color: 'var(--up)', fontSize: 11, borderRadius: 2, lineHeight: 1.6, marginBottom: 14 }}>
              Password updated. You can now sign in with your new password.
            </div>
            <a
              href="/auth/signin"
              style={{
                display: 'block', textAlign: 'center', padding: '10px 0',
                background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: font, fontSize: 11,
                fontWeight: 700, letterSpacing: '0.1em', borderRadius: 2, textDecoration: 'none',
              }}
            >
              GO TO SIGN IN →
            </a>
          </>
        ) : token === '' ? (
          <div style={{ padding: '10px 12px', background: 'var(--down-soft)', border: 'var(--bw) solid var(--down)', color: 'var(--down)', fontSize: 11, borderRadius: 2, lineHeight: 1.6 }}>
            This reset link is missing its token. <a href="/auth/forgot-password" style={{ color: 'var(--accent-text)' }}>Request a new reset link</a>.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.08em' }}>NEW PASSWORD</div>
                <input
                  style={inputStyle}
                  type="password" value={password} placeholder="Min 8 characters" required aria-label="New password"
                  onChange={e => setPassword(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.08em' }}>CONFIRM NEW PASSWORD</div>
                <input
                  style={inputStyle}
                  type="password" value={confirm} placeholder="••••••••" required aria-label="Confirm new password"
                  onChange={e => setConfirm(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {error && (
                <div style={{ padding: '6px 10px', background: 'var(--down-soft)', border: 'var(--bw) solid var(--down)', color: 'var(--down)', fontSize: 10, borderRadius: 2, lineHeight: 1.5 }}>
                  {error} <a href="/auth/forgot-password" style={{ color: 'var(--accent-text)' }}>Request a new reset link</a>.
                </div>
              )}

              <button
                type="submit" disabled={loading || token === null} aria-busy={loading}
                style={{
                  width: '100%', padding: '10px 0',
                  background: loading ? 'var(--border)' : 'var(--accent)', color: loading ? 'var(--muted)' : 'var(--on-accent)',
                  border: 'none', fontFamily: font, fontSize: 11, fontWeight: 700,
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

        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: 'var(--bw) solid var(--border)' }}>
          <a href="/auth/signin" style={{ fontSize: 9, color: 'var(--muted)', textDecoration: 'none' }}>← Back to Sign In</a>
        </div>
      </div>
    </div>
  );
}
