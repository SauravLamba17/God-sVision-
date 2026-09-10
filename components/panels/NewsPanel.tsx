'use client'
import { useEffect, useState } from 'react'
import PanelWrapper from './PanelWrapper'
import { timeAgo } from '@/lib/utils'

interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  sentiment: 'positive' | 'negative' | 'neutral'
  category: string
}

const SENTIMENT_COLORS = {
  positive: 'var(--text-positive)',
  negative: 'var(--text-negative)',
  neutral: 'var(--text-muted)',
}

const SENTIMENT_LABELS = {
  positive: 'POS',
  negative: 'NEG',
  neutral: 'NEU',
}

export default function NewsPanel({ limit = 10 }: { limit?: number }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('live')
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const fetchData = async () => {
    try {
      const res = await fetch('/api/news')
      const json = await res.json()
      if (json.data) {
        const newItems = json.data.slice(0, limit)
        const currentIds = new Set(news.map(n => n.id))
        const freshIds: string[] = newItems.filter((n: NewsItem) => !currentIds.has(n.id)).map((n: NewsItem) => n.id)
        setNewIds(new Set<string>(freshIds))
        setTimeout(() => setNewIds(new Set()), 2000)
        setNews(newItems)
        setSource(json.source)
        setError(null)
      }
    } catch (e) {
      setError('Failed to fetch news')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 300000)
    return () => clearInterval(id)
  }, [])

  return (
    <PanelWrapper title="BREAKING NEWS" loading={loading} error={error} source={source} onRefresh={fetchData}>
      <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
        {news.map(item => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block px-2 py-1.5 hover:bg-header transition-colors ${newIds.has(item.id) ? 'cell-flash-green' : ''}`}
          >
            <div className="flex items-start gap-2">
              <span
                className="font-mono text-[10px] px-1 py-0.5 flex-shrink-0 mt-0.5"
                style={{ color: SENTIMENT_COLORS[item.sentiment], border: `1px solid ${SENTIMENT_COLORS[item.sentiment]}40` }}
              >
                {SENTIMENT_LABELS[item.sentiment]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-[13px] leading-tight line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-accent text-[11px] font-mono">{item.source}</span>
                  <span className="text-muted text-[11px] font-mono">{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </PanelWrapper>
  )
}
