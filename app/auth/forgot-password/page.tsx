'use client';
import { useState } from 'react';

const mono = 'IBM Plex Mono, monospace';

// "2400" -> "40 minutes". Rounds up so we never tell someone to retry early.
function formatRetry(seconds: number): string {
  if (seconds <= 60) return 'in less than a minute';
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.ceil(mins / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 429) {
        const when = typeof data.retryAfterSeconds === 'number' ? ` Try again ${formatRetry(data.retryAfterSeconds)}.` : '';
        setError(`Too many reset requests for that email.${when}`);
        setLoading(false);
        return;
      }
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return; }
      setSent(true); setLoading(false);
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
          <div style={{ fontSize: 9, color: '#607d8b', letterSpacing: '0.2em', marginTop: 4 }}>PASSWORD RESET</div>
        </div>

        {sent ? (
          <div style={{ padding: '10px 12px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', fontSize: 11, borderRadius: 2, lineHeight: 1.6 }}>
            If an account exists with that email, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 10, color: '#607d8b', lineHeight: 1.6 }}>
                Enter the email on your account and we&apos;ll send a link to set a new password. The link expires in 1 hour.
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#607d8b', marginBottom: 4, letterSpacing: '0.08em' }}>EMAIL</div>
                <input
                  style={inputStyle}
                  type="email" value={email} placeholder="you@example.com" required
                  onChange={e => setEmail(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#ff6d00')}
                  onBlur={e => (e.target.style.borderColor = '#1b2e1b')}
                />
              </div>

              {error && (
                <div style={{ padding: '6px 10px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#ff1744', fontSize: 10, borderRadius: 2 }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading} aria-busy={loading}
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
                    SENDING…
                  </span>
                ) : 'SEND RESET LINK →'}
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
