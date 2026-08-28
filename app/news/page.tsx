'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { timeAgo } from '@/lib/utils'

const CATEGORIES = ['All', 'Business', 'Tech', 'World', 'Science', 'Politics', 'Health', 'Sports', 'Energy', 'India']
const REFRESH_INTERVAL = 300 // seconds — each refresh also POSTs to /api/news/sentiment (Gemini + Prisma)

const SENTIMENT_COLORS = { positive: 'var(--text-positive)', negative: 'var(--text-negative)', neutral: 'var(--text-muted)' } as const
const SENTIMENT_LABELS = { positive: 'POS', negative: 'NEG', neutral: 'NEU' } as const
type Sentiment = 'positive' | 'negative' | 'neutral'

type AISentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
const AI_COLORS: Record<AISentiment, string> = { BULLISH: 'var(--text-positive)', BEARISH: 'var(--text-negative)', NEUTRAL: 'var(--text-warning)' }

interface NewsItem {
  id: string
  title: string
  description: string
  url: string
  source: string
  category: string
  publishedAt: string
  sentiment: Sentiment
}

interface Meta {
  total: number
  sources: number
  lastUpdated: string
  feedNames: string[]
}

interface MarketMood {
  bullish: number
  bearish: number
  neutral: number
  dominantSentiment: AISentiment
  score: number
}

function MarketMoodBar({ mood }: { mood: MarketMood }) {
  const color = mood.dominantSentiment === 'BULLISH' ? 'var(--text-positive)' : mood.dominantSentiment === 'BEARISH' ? 'var(--text-negative)' : 'var(--text-warning)'
  return (
    <div style={{ padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>AI MARKET MOOD:</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color, letterSpacing: '0.1em' }}>{mood.dominantSentiment}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: `${mood.bullish}%`, background: 'var(--text-positive)', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${mood.neutral}%`, background: 'var(--text-warning)', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${mood.bearish}%`, background: 'var(--text-negative)', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-positive)', flexShrink: 0 }}>▲{mood.bullish}%</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-warning)', flexShrink: 0 }}>{mood.neutral}%</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-negative)', flexShrink: 0 }}>▼{mood.bearish}%</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>SCORE: {mood.score > 0 ? '+' : ''}{mood.score}</span>
    </div>
  )
}

function articleAge(publishedAt: string): number {
  return Date.now() - new Date(publishedAt).getTime()
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [aiSentiments, setAiSentiments] = useState<Map<string, AISentiment>>(new Map())
  const [marketMood, setMarketMood] = useState<MarketMood | null>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news')
      const json = await res.json()
      if (json.data) {
        const incoming: NewsItem[] = json.data
        const fresh = incoming.filter(n => !prevIdsRef.current.has(n.id)).map(n => n.id)
        if (fresh.length > 0 && prevIdsRef.current.size > 0) {
          const freshSet = new Set(fresh)
          setNewIds(freshSet)
          setTimeout(() => setNewIds(new Set()), 5000)
        }
        prevIdsRef.current = new Set(incoming.map(n => n.id))
        setNews(incoming)
        if (json.meta) setMeta(json.meta)
        setLastFetched(new Date())
        setCountdown(REFRESH_INTERVAL)
        // Score headlines with AI in background
        const headlines = incoming.slice(0, 30).map(n => n.title)
        fetch('/api/news/sentiment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ headlines }) })
          .then(r => r.json())
          .then(sr => {
            if (sr.data) {
              const map = new Map<string, AISentiment>()
              for (const s of sr.data) map.set(s.headline, s.sentiment as AISentiment)
              setAiSentiments(map)
            }
            if (sr.mood) setMarketMood(sr.mood)
          })
          .catch(() => {})
      }
    } catch {
      // silent — keep showing stale data
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, REFRESH_INTERVAL * 1000)
    return () => clearInterval(id)
  }, [fetchNews])

  // Live countdown tick (independent of fetch)
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  // Reset countdown when category changes (triggers fresh fetch via polling)
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL)
  }, [category])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: news.length }
    CATEGORIES.forEach(cat => {
      if (cat === 'All') return
      counts[cat] = news.filter(n => n.category.toLowerCase() === cat.toLowerCase()).length
    })
    return counts
  }, [news])

  const filtered = useMemo(() => {
    let items = news
    if (category !== 'All') {
      items = items.filter(n => n.category.toLowerCase() === category.toLowerCase())
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q)
      )
    }
    return items
  }, [news, category, search])

  const hasBreaking = filtered.slice(0, 10).some(n => articleAge(n.publishedAt) < 5 * 60 * 1000)

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countdownStr = `${mins}:${String(secs).padStart(2, '0')}`

  const topSources = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(n => { counts[n.source] = (counts[n.source] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [filtered])

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-terminal)' }}>
      {/* Left Sidebar */}
      <div style={{ width: 168, flexShrink: 0, borderRight: '1px solid #1e293b', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column' }}>
        {/* Live status */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="status-dot status-live" />
            <span className="font-mono text-[10px] text-positive font-bold">LIVE FEED</span>
          </div>
          <div className="font-mono text-[9px] text-muted">
            {meta ? `${meta.sources} SOURCES` : '50+ SOURCES'}
          </div>
          <div className="font-mono text-[9px] text-muted mt-0.5">
            REFRESH {countdownStr}
          </div>
          {lastFetched && (
            <div className="font-mono text-[8px] text-muted mt-0.5 opacity-60">
              UPDATED {timeAgo(lastFetched.toISOString())}
            </div>
          )}
        </div>

        {/* Categories */}
        <div style={{ padding: '6px 8px', borderBottom: '1px solid #1e293b' }}>
          <div className="font-mono text-[9px] text-accent font-bold mb-2 tracking-widest">CATEGORY</div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="w-full text-left flex items-center justify-between mb-px"
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10,
                padding: '3px 6px',
                background: category === cat ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: category === cat ? 'var(--text-accent)' : 'var(--text-secondary)',
                border: category === cat ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              <span>{cat.toUpperCase()}</span>
              {(categoryCounts[cat] || 0) > 0 && (
                <span style={{ fontSize: 8, color: category === cat ? 'var(--text-accent)' : 'var(--text-muted)' }}>
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Top Active Sources */}
        <div style={{ flex: 1, padding: '6px 8px', overflowY: 'auto' }}>
          <div className="font-mono text-[9px] text-accent font-bold mb-2 tracking-widest">TOP SOURCES</div>
          {topSources.map(([src, count]) => (
            <div key={src} className="flex items-center justify-between py-px">
              <div className="flex items-center gap-1.5">
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-positive)', display: 'inline-block', flexShrink: 0 }} />
                <span className="font-mono text-[9px] text-muted truncate" style={{ maxWidth: 100 }}>{src}</span>
              </div>
              <span className="font-mono text-[8px] text-muted opacity-60">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Market Mood Bar */}
        {marketMood && <MarketMoodBar mood={marketMood} />}
        {/* Breaking Banner */}
        {hasBreaking && (
          <div
            className="flex items-center justify-center font-mono text-[10px] text-negative font-bold animate-pulse flex-shrink-0"
            style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.4)' }}
          >
            ⚠ BREAKING — NEW STORIES IN THE LAST 5 MINUTES
          </div>
        )}

        {/* Search + Status Bar */}
        <div style={{ borderBottom: '1px solid #1e293b', padding: '5px 12px', background: 'var(--bg-panel)', flexShrink: 0 }} className="flex items-center gap-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH HEADLINES, SOURCES..."
            className="input-terminal"
            style={{ width: 280 }}
          />
          <span className="font-mono text-[9px] text-muted">
            {filtered.length} ARTICLES
          </span>
          <span className="font-mono text-[9px] text-muted">|</span>
          <span className="font-mono text-[9px] text-muted">
            {meta?.sources || '—'} SOURCES LIVE
          </span>
          <span className="font-mono text-[9px] text-muted">|</span>
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-live" style={{ width: 5, height: 5 }} />
            <span className="font-mono text-[9px] text-positive">REFRESHES IN {countdownStr}</span>
          </div>
          <button
            onClick={() => { fetchNews(); setCountdown(REFRESH_INTERVAL) }}
            className="font-mono text-[9px] text-accent hover:text-primary transition-colors ml-auto"
            style={{ border: '1px solid #1e293b', padding: '2px 8px', background: 'transparent', cursor: 'pointer' }}
          >
            ↺ REFRESH NOW
          </button>
        </div>

        {/* Article Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <span className="font-mono text-[11px] text-positive">CONNECTING TO NEWS NETWORKS<span className="blink-cursor" /></span>
            <span className="font-mono text-[9px] text-muted">50+ RSS FEEDS • GOOGLE NEWS • HACKERNEWS • REDDIT</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map(item => {
              const age = articleAge(item.publishedAt)
              const isVeryNew = age < 5 * 60 * 1000
              const isNew = age < 15 * 60 * 1000
              const isFlashing = newIds.has(item.id)

              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block px-4 py-2.5 hover:bg-header transition-colors ${isFlashing ? 'cell-flash-green' : ''}`}
                  style={{ borderBottom: '1px solid #0f1929' }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* AI Sentiment Badge */}
                    {aiSentiments.get(item.title) ? (
                      <span
                        className="font-mono text-[8px] px-1 py-px flex-shrink-0 mt-0.5"
                        style={{
                          color: AI_COLORS[aiSentiments.get(item.title)!],
                          border: `1px solid ${AI_COLORS[aiSentiments.get(item.title)!]}50`,
                          background: `${AI_COLORS[aiSentiments.get(item.title)!]}10`,
                          minWidth: 40,
                          textAlign: 'center',
                        }}
                      >
                        {aiSentiments.get(item.title)}
                      </span>
                    ) : (
                      <span
                        className="font-mono text-[8px] px-1 py-px flex-shrink-0 mt-0.5"
                        style={{
                          color: SENTIMENT_COLORS[item.sentiment],
                          border: `1px solid ${SENTIMENT_COLORS[item.sentiment]}50`,
                          background: `${SENTIMENT_COLORS[item.sentiment]}10`,
                          minWidth: 28,
                          textAlign: 'center',
                        }}
                      >
                        {SENTIMENT_LABELS[item.sentiment]}
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <h3 className="text-primary text-[12px] leading-snug font-medium flex-1" style={{ lineHeight: '1.4' }}>
                          {item.title}
                        </h3>
                        {/* NEW / BREAKING badges */}
                        {isVeryNew && (
                          <span className="font-mono text-[8px] px-1.5 py-px flex-shrink-0 font-bold animate-pulse"
                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: 'var(--text-negative)', borderRadius: 2 }}>
                            BREAKING
                          </span>
                        )}
                        {!isVeryNew && isNew && (
                          <span className="font-mono text-[8px] px-1.5 py-px flex-shrink-0 font-bold"
                            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: 'var(--text-positive)', borderRadius: 2 }}>
                            NEW
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-muted text-[10px] mt-0.5 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--text-accent)' }}>{item.source}</span>
                        <span className="text-muted text-[9px]">•</span>
                        <span className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.category.toUpperCase()}</span>
                        <span className="text-muted text-[9px]">•</span>
                        <span className="font-mono text-[9px]" style={{ color: isVeryNew ? 'var(--text-negative)' : isNew ? 'var(--text-positive)' : 'var(--text-muted)' }}>
                          {timeAgo(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div className="flex items-center justify-center h-32">
                <span className="font-mono text-[11px] text-muted">NO ARTICLES MATCH YOUR FILTER</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
