'use client';
import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function PushSubscribe() {
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const subscribe = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert('Push notifications not configured');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setSubscribed(true);
    } catch (e) {
      console.error('[Push] Subscribe failed:', e);
    }
  };

  if (!supported) return null;

  return (
    <button onClick={subscribe} disabled={subscribed} style={{
      background: subscribed ? 'var(--bg-hover)' : 'transparent',
      border: '1px solid var(--border-color)',
      color: subscribed ? 'var(--text-positive)' : 'var(--text-secondary)',
      padding: '6px 14px', fontSize: '10px', fontWeight: 700,
      borderRadius: '3px', cursor: subscribed ? 'default' : 'pointer',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      {subscribed ? '✓ PUSH ENABLED' : '🔔 ENABLE PUSH ALERTS'}
    </button>
  );
}
