'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const mono = 'IBM Plex Mono, monospace';

export default function SignInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError('Invalid email or password'); return; }
    router.push('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Registration failed'); return; }
    setSuccess('Account created. Signing you in...');
    const signRes = await signIn('credentials', { email, password, redirect: false });
    if (signRes?.error) { setError('Login after register failed'); return; }
    router.push('/');
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
