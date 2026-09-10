'use client'
import { useEffect, useState } from 'react'

interface TickerMention {
  ticker: string
  mentions: number
  avgScore: number
  sentiment: 'BULLISH' | 'BEARISH' | 'MIXED'
  topPost: { title: string; score: number; url: string; subreddit: string }
  subreddits: string[]
}

function SentimentBadge({ s }: { s: string }) {
  const cfg = { BULLISH:{ color:'var(--text-positive)', bg:'rgba(34,197,94,0.12)' }, BEARISH:{ color:'var(--text-negative)', bg:'rgba(239,68,68,0.12)' }, MIXED:{ color:'var(--text-warning)', bg:'rgba(245,158,11,0.12)' } }
  const c = cfg[s as keyof typeof cfg] || cfg.MIXED
  return <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-badge)', fontWeight:700, color:c.color, background:c.bg, padding:'1px 5px', borderRadius:2 }}>{s}</span>
}

export default function RedditSentiment() {
  const [mentions, setMentions] = useState<TickerMention[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/reddit')
        const j = await res.json()
        if (j.data) setMentions(j.data.slice(0, 10))
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 900000) // 15 min
    return () => clearInterval(id)
  }, [])

  if (loading) return <div style={{ padding:12, fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-accent)' }}>LOADING<span className="blink-cursor" /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ padding:'4px 8px', borderBottom:'1px solid #1b2e1b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>TICKER · MENTIONS · SENTIMENT</span>
        <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>r/WSB + r/investing + r/stocks</span>
      </div>
      {mentions.map((m, i) => (
        <div key={m.ticker}>
          <div
            onClick={() => setExpanded(expanded === m.ticker ? null : m.ticker)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderBottom:'1px solid #0d1526', cursor:'pointer', background: expanded===m.ticker ? 'rgba(255,109,0,0.05)' : 'transparent' }}
          >
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)', width:12 }}>{i+1}</span>
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', fontWeight:700, color:'var(--text-accent)', width:56 }}>{m.ticker}</span>
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-secondary)', width:28 }}>{m.mentions}</span>
            <SentimentBadge s={m.sentiment} />
            {m.subreddits.includes('wallstreetbets') && m.avgScore > 1000 && (
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-badge)', color:'#fff', background:'var(--text-negative)', padding:'1px 4px', borderRadius:2 }}>WSB</span>
            )}
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginLeft:'auto' }}>{expanded===m.ticker?'▲':'▼'}</span>
          </div>
          {expanded === m.ticker && (
            <div style={{ background:'var(--bg-terminal)', borderBottom:'1px solid #1b2e1b', padding:'8px 12px' }}>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginBottom:4 }}>TOP POST:</div>
              <a href={m.topPost.url} target="_blank" rel="noreferrer"
                style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-accent)', textDecoration:'none', display:'block', lineHeight:1.4, marginBottom:4 }}>
                {m.topPost.title.slice(0, 120)}{m.topPost.title.length > 120 ? '…' : ''}
              </a>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>
                r/{m.topPost.subreddit} · {m.topPost.score.toLocaleString()} pts · avg {m.avgScore} pts
              </div>
            </div>
          )}
        </div>
      ))}
      {mentions.length === 0 && (
        <div style={{ padding:16, fontFamily:'IBM Plex Mono', fontSize:'var(--fs-body)', color:'var(--text-muted)', textAlign:'center' }}>
          No ticker mentions fetched yet — Reddit APIs may be throttled.
        </div>
      )}
    </div>
  )
}
