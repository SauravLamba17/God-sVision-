'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function NewsModule({ compact }: Props) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const limit = compact ? 10 : 20;
    const load = () =>
      fetch('/api/news')
        .then(r => r.json())
        .then(d => { setArticles(Array.isArray(d.articles) ? d.articles.slice(0, limit) : []); setLoading(false); })
        .catch(() => setLoading(false));
    load();
    const iv = setInterval(load, 300000);
    return () => clearInterval(iv);
  }, [compact]);

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>NEWS</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : articles.map((a: any, i: number) => (
          <div key={i}
            onClick={() => a.url && window.open(a.url, '_blank')}
            style={{ padding: compact ? '4px 6px' : '5px 8px', borderBottom: '1px solid var(--border-dim)', cursor: a.url ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (a.url) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
            <div style={{ fontSize: 8, color: 'var(--text-accent)', marginBottom: 2, fontWeight: 700 }}>
              {a.source?.name ?? a.source ?? 'NEWS'}
            </div>
            <div style={{ fontSize: fs, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {compact ? (a.title ?? '').slice(0, 85) + ((a.title?.length ?? 0) > 85 ? '…' : '') : a.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
