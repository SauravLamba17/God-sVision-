'use client'
import { useState, useMemo } from 'react'
import { GLOSSARY, GlossaryEntry } from '@/lib/glossary'
import { tint } from '@/lib/context/ThemeContext'

const CATEGORIES = ['ALL', 'BASIC', 'TECHNICAL', 'OPTIONS', 'MACRO', 'INDIA', 'CRYPTO'] as const

// Category accents are theme tokens (each meets AA/AAA as text in every look).
const CAT_COLOR: Record<string, string> = {
  BASIC: 'var(--text-2)',
  TECHNICAL: 'var(--info)',
  OPTIONS: 'var(--warning)',
  MACRO: 'var(--up)',
  INDIA: 'var(--accent-text)',
  CRYPTO: 'var(--down)',
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
      padding: '12px 16px',
      minHeight: '100%',
      background: 'var(--bg-terminal)',
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: 'var(--bw) solid var(--divider)',
        paddingBottom: 10,
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            📚 FINANCIAL GLOSSARY
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            Showing {entries.length} of {total} terms — hover any ℹ icon in the terminal for instant definitions
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' }}>
          GOD's Vision · Financial Education
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search any term... (e.g. RSI, P/E, options, SEBI)"
        aria-label="Search glossary"
        className="input-terminal"
        style={{ fontSize: 12, padding: '8px 12px', marginBottom: 10 }}
      />

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className="gv-tab"
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
            style={{ fontSize: 9 }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 10 }}>
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
                border: 'var(--bw) solid var(--border)',
                borderLeft: `3px solid ${catColor}`,
                background: 'var(--surface)',
                borderRadius: 'var(--radius-inner)',
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
                      background: tint(catColor, 8),
                      color: catColor,
                      border: `1px solid ${catColor}`,
                      letterSpacing: '0.08em',
                    }}>{entry.category}</span>
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                  }}>{entry.simpleDefinition}</div>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>

              {isExpanded && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: 'var(--bw) solid var(--divider)',
                }}>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}>{entry.detailedDefinition}</div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    background: 'var(--surface-2)',
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
          color: 'var(--text-muted)',
          fontSize: 12,
        }}>
          No terms found for &quot;{search}&quot;. Try a different search.
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 20,
        padding: '10px 0',
        borderTop: 'var(--bw) solid var(--divider)',
        fontSize: 9,
        color: 'var(--text-muted)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        ⚠ FOR EDUCATIONAL PURPOSES ONLY. Not financial advice. Always consult a SEBI-registered advisor before investing.
        <br />
        GOD's Vision Financial Glossary · {total} terms
      </div>
    </div>
  )
}
