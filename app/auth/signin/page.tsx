'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { safeCallbackUrl } from '@/lib/safeRedirect';

const font = 'var(--font-sans), system-ui, sans-serif'; // UI font (tokens: app/globals.css)

// useSearchParams() opts the subtree into client-side rendering, so it needs a
// Suspense boundary to keep `next build` from bailing on static generation.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  // The landing page's "Get started" links arrive at ?tab=register; anything
  // else lands on the Sign In tab exactly as before.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'signin' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'signin'
  );
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
    // Same-origin only (the old startsWith('/') check let "/\evil.com" through).
    window.location.href = safeCallbackUrl(params.get('callbackUrl'), window.location.origin);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error === 'TooManyAttempts') { setError('Too many sign-in attempts. Please wait 15 minutes and try again.'); setLoading(false); return; }
      if (res?.error) { setError('Invalid email or password'); setLoading(false); return; }
      if (res?.ok) { gotoCallback(); return; }
      setError('Something went wrong. Please try again.'); setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong'); setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
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
    width: '100%', background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
    color: 'var(--text)', fontFamily: font, fontSize: 12, padding: '8px 12px',
    borderRadius: 2, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? 'var(--on-accent)' : 'var(--muted)', border: 'var(--bw) solid var(--border)',
    fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: font,
    }}>
      <div style={{ width: 380, background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderTop: 'var(--stripe) solid var(--stripe-color)', borderRadius: 'var(--radius)', padding: 28 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, color: 'var(--text)', fontWeight: 700 }}>GOD&apos;s <span style={{ color: 'var(--accent-text)' }}>Vision</span></div>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.2em', marginTop: 4 }}>FINANCIAL INTELLIGENCE TERMINAL</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          <button type="button" disabled={loading} style={{ ...tabStyle(tab === 'signin'), cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && tab !== 'signin' ? 0.5 : 1 }} onClick={() => { setTab('signin'); setError(''); }}>SIGN IN</button>
          <button type="button" disabled={loading} style={{ ...tabStyle(tab === 'register'), cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && tab !== 'register' ? 0.5 : 1 }} onClick={() => { setTab('register'); setError(''); }}>REGISTER</button>
        </div>

        {/* Form */}
        <form onSubmit={tab === 'signin' ? handleSignIn : handleRegister}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'register' && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.08em' }}>NAME</div>
                <input
                  style={inputStyle}
                  type="text" value={name} placeholder="Your name" aria-label="Name"
                  onChange={e => setName(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.08em' }}>EMAIL</div>
              <input
                style={inputStyle}
                type="email" value={email} placeholder="you@example.com" required aria-label="Email"
                onChange={e => setEmail(e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>PASSWORD</div>
                {tab === 'signin' && (
                  <a href="/auth/forgot-password" style={{ fontSize: 9, color: 'var(--muted)', textDecoration: 'none' }}>Forgot password?</a>
                )}
              </div>
              <input
                style={inputStyle}
                type="password" value={password} placeholder={tab === 'register' ? 'Min 8 characters' : '••••••••'} required aria-label="Password"
                onChange={e => setPassword(e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div style={{ padding: '6px 10px', background: 'var(--down-soft)', border: 'var(--bw) solid var(--down)', color: 'var(--down)', fontSize: 10, borderRadius: 'var(--radius-inner)' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '6px 10px', background: 'var(--up-soft)', border: 'var(--bw) solid var(--up)', color: 'var(--up)', fontSize: 10, borderRadius: 'var(--radius-inner)' }}>
                {success}
              </div>
            )}

            <button
              type="submit" disabled={loading} aria-busy={loading}
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
                  {tab === 'signin' ? 'SIGNING IN…' : 'CREATING ACCOUNT…'}
                </span>
              ) : tab === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
            </button>
          </div>
        </form>

        {/* Plan comparison */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: 'var(--bw) solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 10, textAlign: 'center' }}>PLAN COMPARISON</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: '10px', border: 'var(--bw) solid var(--border)', borderRadius: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>FREE</div>
              {['Markets & News', 'Crypto & Forex', 'Watchlist (10)', 'Basic Alerts (2)'].map(f => (
                <div key={f} style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>✓ {f}</div>
              ))}
            </div>
            <div style={{ padding: '10px', border: 'var(--bw) solid var(--accent)', borderRadius: 'var(--radius-inner)', background: 'var(--accent-soft)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', marginBottom: 6 }}>★ PRO — $29/mo</div>
              {['AI Analyst Engine', 'India Mode (NSE/BSE)', 'Unlimited Alerts', 'Correlation + Insiders'].map(f => (
                <div key={f} style={{ fontSize: 9, color: 'var(--text-2)', marginBottom: 3 }}>✓ {f}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: 9, color: 'var(--muted)', textDecoration: 'none' }}>← Back to home</a>
        </div>
      </div>
    </div>
  );
}
