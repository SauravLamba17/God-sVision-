'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

const mono = 'IBM Plex Mono, monospace';

export default function SignInPage() {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // After a successful sign-in, send the user to wherever the auth gate
  // bounced them from (?callbackUrl=…), defaulting to the dashboard.
  //
  // Uses a HARD navigation (window.location.href), NOT router.push(): a full
  // document load guarantees the browser sends the freshly-set NextAuth
  // session cookie on the very next request, so the auth-gate middleware sees
  // the session. A client-side router.push() can fire its RSC/middleware
  // request before the just-written cookie is reliably readable, which bounces
  // the user straight back to /auth/signin (the "registers fine but stays on
  // the sign-in page" bug). We intentionally do NOT clear `loading` on this
  // path — the page is already navigating away.
  const gotoCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get('callbackUrl') || '/';
    // Only allow same-origin relative paths — never an attacker-supplied absolute URL.
    const safe = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/';
    window.location.href = safe;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) { setError('Invalid email or password'); setLoading(false); return; }
      if (res?.ok) { gotoCallback(); return; }
      setError('Something went wrong. Please try again.'); setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong'); setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); return; }
      // Registration succeeded — immediately establish a session with the same
      // credentials, then hard-redirect (keeping the button in its loading
      // state through the whole register → sign-in → redirect chain).
      setSuccess('Account created. Signing you in...');
      const signRes = await signIn('credentials', { email, password, redirect: false });
      if (signRes?.error) { setError('Login after register failed: ' + signRes.error); setLoading(false); return; }
      if (signRes?.ok) { gotoCallback(); return; }
      setError('Account created, but automatic sign-in failed. Please sign in manually.'); setLoading(false);
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', background: active ? '#ff6d00' : '#0a140a',
    color: active ? '#000' : '#607d8b', border: '1px solid #1b2e1b',
    fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', background: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: mono,
    }}>
      <div style={{ width: 380, background: '#050a05', border: '1px solid #1b2e1b', borderTop: '2px solid #ff6d00', padding: 28 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, color: '#ff6d00', fontWeight: 700, letterSpacing: '0.12em' }}>⚡ GOD'S VISION</div>
          <div style={{ fontSize: 9, color: '#607d8b', letterSpacing: '0.2em', marginTop: 4 }}>FINANCIAL INTELLIGENCE TERMINAL</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          <button style={tabStyle(tab === 'signin')} onClick={() => { setTab('signin'); setError(''); }}>SIGN IN</button>
          <button style={tabStyle(tab === 'register')} onClick={() => { setTab('register'); setError(''); }}>REGISTER</button>
        </div>

        {/* Form */}
        <form onSubmit={tab === 'signin' ? handleSignIn : handleRegister}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'register' && (
              <div>
                <div style={{ fontSize: 9, color: '#607d8b', marginBottom: 4, letterSpacing: '0.08em' }}>NAME</div>
                <input
                  style={inputStyle}
                  type="text" value={name} placeholder="Your name"
                  onChange={e => setName(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#ff6d00')}
                  onBlur={e => (e.target.style.borderColor = '#1b2e1b')}
                />
              </div>
            )}
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
            <div>
              <div style={{ fontSize: 9, color: '#607d8b', marginBottom: 4, letterSpacing: '0.08em' }}>PASSWORD</div>
              <input
                style={inputStyle}
                type="password" value={password} placeholder={tab === 'register' ? 'Min 8 characters' : '••••••••'} required
                onChange={e => setPassword(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#ff6d00')}
                onBlur={e => (e.target.style.borderColor = '#1b2e1b')}
              />
            </div>

            {error && (
              <div style={{ padding: '6px 10px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#ff1744', fontSize: 10, borderRadius: 2 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '6px 10px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', fontSize: 10, borderRadius: 2 }}>
                {success}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '10px 0',
                background: loading ? '#1b2e1b' : '#ff6d00', color: loading ? '#607d8b' : '#000',
                border: 'none', fontFamily: mono, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: 2, transition: 'all 0.15s',
              }}
            >
              {loading ? '...' : tab === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
            </button>
          </div>
        </form>

        {/* Plan comparison */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1b2e1b' }}>
          <div style={{ fontSize: 9, color: '#607d8b', letterSpacing: '0.1em', marginBottom: 10, textAlign: 'center' }}>PLAN COMPARISON</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: '10px', border: '1px solid #1b2e1b', borderRadius: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#88aa88', marginBottom: 6 }}>FREE</div>
              {['Markets & News', 'Crypto & Forex', 'Watchlist (10)', 'Basic Alerts (2)'].map(f => (
                <div key={f} style={{ fontSize: 9, color: '#607d8b', marginBottom: 3 }}>✓ {f}</div>
              ))}
            </div>
            <div style={{ padding: '10px', border: '1px solid rgba(255,109,0,0.4)', borderRadius: 2, background: 'rgba(255,109,0,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ff6d00', marginBottom: 6 }}>★ PRO — $29/mo</div>
              {['AI Analyst Engine', 'India Mode (NSE/BSE)', 'Unlimited Alerts', 'Correlation + Insiders'].map(f => (
                <div key={f} style={{ fontSize: 9, color: '#88aa88', marginBottom: 3 }}>✓ {f}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: 9, color: '#607d8b', textDecoration: 'none' }}>← Back to Terminal</a>
        </div>
      </div>
    </div>
  );
}
