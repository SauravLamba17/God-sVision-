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
  const cfg = { BULLISH:{ color:'var(--text-positive)', bg:'var(--up-soft)' }, BEARISH:{ color:'var(--text-negative)', bg:'var(--down-soft)' }, MIXED:{ color:'var(--text-warning)', bg:'var(--warning-soft)' } }
  const c = cfg[s as keyof typeof cfg] || cfg.MIXED
  return <span style={{ fontSize:'var(--fs-badge)', fontWeight:700, color:c.color, background:c.bg, padding:'1px 5px', borderRadius:2 }}>{s}</span>
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
      } catch {
        // Network failure ("Failed to fetch") — keep the panel's unavailable state.
      } finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 900000) // 15 min
    return () => clearInterval(id)
  }, [])

  if (loading) return <div style={{ padding:12, fontSize:'var(--fs-body)', color:'var(--text-accent)' }}>LOADING<span className="blink-cursor" /></div>

  // No rows means the upstream returned nothing. This used to fall back to ten
  // fabricated mentions with invented quotes; say it plainly instead.
  if (mentions.length === 0) return (
    <div style={{ padding:'12px 10px', fontSize:'var(--fs-body)', color:'var(--text-muted)', lineHeight:1.6 }}>
      Reddit sentiment unavailable
      <div style={{ fontSize:'var(--fs-meta)', marginTop:4 }}>
        Reddit no longer serves its public JSON feed to unauthenticated clients (HTTP 403).
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ padding:'4px 8px', borderBottom:'var(--bw) solid var(--divider)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>TICKER · MENTIONS · SENTIMENT</span>
        <span style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>r/WSB + r/investing + r/stocks</span>
      </div>
      {mentions.map((m, i) => (
        <div key={m.ticker}>
          <div
            onClick={() => setExpanded(expanded === m.ticker ? null : m.ticker)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderBottom:'var(--bw) solid var(--divider)', cursor:'pointer', background: expanded===m.ticker ? 'var(--surface-2)' : 'transparent' }}
          >
            <span style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', width:12 }}>{i+1}</span>
            <span style={{ fontSize:'var(--fs-body)', fontWeight:700, color:'var(--text-accent)', width:56 }}>{m.ticker}</span>
            <span style={{ fontSize:'var(--fs-body)', color:'var(--text-secondary)', width:28 }}>{m.mentions}</span>
            <SentimentBadge s={m.sentiment} />
            {m.subreddits.includes('wallstreetbets') && m.avgScore > 1000 && (
              <span style={{ fontSize:'var(--fs-badge)', color:'var(--down)', border:'var(--bw) solid currentColor', padding:'0 4px', borderRadius:4 }}>WSB</span>
            )}
            <span style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginLeft:'auto' }}>{expanded===m.ticker?'▲':'▼'}</span>
          </div>
          {expanded === m.ticker && (
            <div style={{ background:'var(--surface-2)', borderBottom:'var(--bw) solid var(--divider)', padding:'8px 12px' }}>
              <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)', marginBottom:4 }}>TOP POST:</div>
              <a href={m.topPost.url} target="_blank" rel="noreferrer"
                style={{ fontSize:'var(--fs-body)', color:'var(--text-accent)', textDecoration:'none', display:'block', lineHeight:1.4, marginBottom:4 }}>
                {m.topPost.title.slice(0, 120)}{m.topPost.title.length > 120 ? '…' : ''}
              </a>
              <div style={{ fontSize:'var(--fs-meta)', color:'var(--text-muted)' }}>
                r/{m.topPost.subreddit} · {m.topPost.score.toLocaleString()} pts · avg {m.avgScore} pts
              </div>
            </div>
          )}
        </div>
      ))}
      {mentions.length === 0 && (
        <div style={{ padding:16, fontSize:'var(--fs-body)', color:'var(--text-muted)', textAlign:'center' }}>
          No ticker mentions fetched yet — Reddit APIs may be throttled.
        </div>
      )}
    </div>
  )
}
