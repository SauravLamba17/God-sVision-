'use client'
import { useState, useMemo } from 'react'
import { GLOSSARY, GlossaryEntry } from '@/lib/glossary'

const CATEGORIES = ['ALL', 'BASIC', 'TECHNICAL', 'OPTIONS', 'MACRO', 'INDIA', 'CRYPTO'] as const

const CAT_COLOR: Record<string, string> = {
  BASIC: 'var(--text-accent)',
  TECHNICAL: '#a78bfa',
  OPTIONS: '#fb923c',
  MACRO: '#34d399',
  INDIA: '#FF9933',
  CRYPTO: 'var(--text-warning)',
}

export default function GlossaryPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)

  const entries = useMemo(() => {
    const q = search.toLowerCase()
    return Object.entries(GLOSSARY)
      .filter(([, e]) => {
        const matchCat = category === 'ALL' || e.category === category
        const matchSearch =
          !q ||
          e.term.toLowerCase().includes(q) ||
          e.simpleDefinition.toLowerCase().includes(q) ||
          e.example.toLowerCase().includes(q)
        return matchCat && matchSearch
      })
      .sort(([, a], [, b]) => a.term.localeCompare(b.term))
  }, [search, category])

  const total = Object.keys(GLOSSARY).length

  return (
    <div style={{
      fontFamily: 'IBM Plex Mono',
      padding: '12px 16px',
      minHeight: '100%',
      background: 'var(--bg-terminal, #020817)',
      color: 'var(--text-primary, #e2e8f0)',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-dim, #1e293b)',
        paddingBottom: 10,
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-accent, #38bdf8)', letterSpacing: '0.08em' }}>
            ðŸ“š FINANCIAL GLOSSARY
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #475569)', marginTop: 3 }}>
            Showing {entries.length} of {total} terms â€” hover any â„¹ icon in the terminal for instant definitions
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted, #475569)', textAlign: 'right' }}>
          GOD&apos;s Vision Â· Financial Education
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search any term... (e.g. RSI, P/E, options, SEBI)"
        style={{
          width: '100%',
          background: 'var(--bg-input, #0d1526)',
          border: '1px solid var(--border-dim, #1e293b)',
          color: 'var(--text-primary, #e2e8f0)',
          fontFamily: 'IBM Plex Mono',
          fontSize: 12,
          padding: '8px 12px',
          borderRadius: 4,
          outline: 'none',
          marginBottom: 10,
          boxSizing: 'border-box',
        }}
      />

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '3px 10px',
              borderRadius: 3,
              border: category === cat
                ? `1px solid ${CAT_COLOR[cat] || 'var(--text-accent)'}`
                : '1px solid var(--border-dim, #1e293b)',
              background: category === cat
                ? `${CAT_COLOR[cat] || 'var(--text-accent)'}18`
                : 'transparent',
              color: category === cat
                ? (CAT_COLOR[cat] || 'var(--text-accent)')
                : 'var(--text-muted, #475569)',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 9, color: 'var(--text-muted, #475569)', marginBottom: 10 }}>
        {entries.length === 0 ? 'No terms match your search.' : `Showing ${entries.length} term${entries.length !== 1 ? 's' : ''}`}
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 8,
      }}>
        {entries.map(([key, entry]) => {
          const isExpanded = expanded === key
          const catColor = CAT_COLOR[entry.category] || 'var(--text-accent)'
          return (
            <div
              key={key}
              onClick={() => setExpanded(isExpanded ? null : key)}
              style={{
                border: `1px solid var(--border-dim, #1e293b)`,
                borderLeft: `3px solid ${catColor}`,
                background: 'var(--bg-panel, #0a0f1e)',
                borderRadius: 3,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'border-color 0.12s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: catColor,
                    }}>{entry.term}</span>
                    <span style={{
                      fontSize: 7,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 2,
                      background: `${catColor}14`,
                      color: catColor,
                      border: `1px solid ${catColor}30`,
                      letterSpacing: '0.08em',
                    }}>{entry.category}</span>
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-primary, #e2e8f0)',
                    lineHeight: 1.5,
                  }}>{entry.simpleDefinition}</div>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted, #475569)', flexShrink: 0 }}>
                  {isExpanded ? 'â–²' : 'â–¼'}
                </span>
              </div>

              {isExpanded && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-dim, #1e293b)',
                }}>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-secondary, #94a3b8)',
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}>{entry.detailedDefinition}</div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted, #475569)',
                    background: 'var(--bg-header, #0d1526)',
                    padding: '6px 8px',
                    borderRadius: 2,
                    lineHeight: 1.5,
                  }}>
                    <span style={{ color: 'var(--text-warning)' }}>Example: </span>
                    {entry.example}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {entries.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted, #475569)',
          fontSize: 12,
        }}>
          No terms found for &quot;{search}&quot;. Try a different search.
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 20,
        padding: '10px 0',
        borderTop: '1px solid var(--border-dim, #1e293b)',
        fontSize: 9,
        color: 'var(--text-muted, #475569)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        âš  FOR EDUCATIONAL PURPOSES ONLY. Not financial advice. Always consult a SEBI-registered advisor before investing.
        <br />
        GOD&apos;s Vision Financial Glossary Â· {total} terms
      </div>
    </div>
  )
}
