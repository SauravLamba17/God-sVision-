'use client';
import { useState, useEffect } from 'react';

interface Props { compact?: boolean; }

export default function SportsModule({ compact }: Props) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const limit = compact ? 6 : 12;
    fetch('/api/sports')
      .then(r => r.json())
      .then(d => { setScores(Array.isArray(d) ? d.slice(0, limit) : Array.isArray(d.data) ? d.data.slice(0, limit) : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [compact]);

  const fs = compact ? '10px' : '11px';

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '3px 8px' : '5px 10px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-header)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-accent)', fontSize: 9, fontWeight: 700, letterSpacing: '1px' }}>SPORTS</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: compact ? '2px' : '4px' }}>
        {loading ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>Loading…</div>
        ) : scores.length === 0 ? (
          <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: fs }}>No live events</div>
        ) : scores.map((s: any, i: number) => (
          <div key={i} style={{ padding: compact ? '4px 6px' : '6px 8px', borderBottom: '1px solid var(--border-dim)', fontSize: fs }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
            <div style={{ color: 'var(--text-muted)', fontSize: 8, marginBottom: 2 }}>
              {s.league ?? s.strLeague ?? s.competition ?? ''}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.homeTeam ?? s.strHomeTeam ?? 'HOME'}
              </span>
              <span style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: compact ? 11 : 12, flexShrink: 0 }}>
                {s.homeScore ?? '—'} : {s.awayScore ?? '—'}
              </span>
              <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {s.awayTeam ?? s.strAwayTeam ?? 'AWAY'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
