'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMode } from '@/lib/context/ModeContext'
import { DataStatusBadge } from '@/components/ui/DataStatusBadge'
import { EXAMPLES, type Answer, type Fact, type FactSheet, type Sentence } from '@/lib/research/types'

// Research Agent: ask a plain question, get a sourced answer built from the app's engines.
// Every sentence cites numbered facts; click a [n] chip to see the fact and its source.
// Answers are automatic (no AI) unless AI prose is enabled server-side, which is labelled.
interface Response {
  answer: Answer & { ai?: { label: string; provider: string; sentences: Sentence[] } }
  facts: Fact[]
  sources: Answer['sources']
  mode: 'automatic' | 'ai'
  dataStatus: FactSheet['dataStatus']
  intent: string
  timings: Record<string, number>
}

const box: React.CSSProperties = { border: '1px solid var(--border-color)', background: 'var(--bg-panel)', padding: '10px 12px', minWidth: 0 }
const head: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-accent)', marginBottom: 6 }
const meta: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)' }
const when = (t: number | string | null) => (t == null ? '' : typeof t === 'number' ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : String(t).slice(0, 10))

function Cite({ n, picked, onPick, fact }: { n: number; picked: boolean; onPick: (n: number) => void; fact?: Fact }) {
  return (
    <button onClick={() => onPick(n)} aria-pressed={picked} aria-label={`Fact ${n}`} title={fact ? `${fact.text} — ${fact.source.name}` : undefined}
      style={{ all: 'unset', cursor: 'pointer', fontSize: 9, fontWeight: 700, padding: '0 3px', marginLeft: 2, border: `1px solid ${picked ? 'var(--text-accent)' : 'var(--border-color)'}`, color: picked ? 'var(--text-accent)' : '#38bdf8', borderRadius: 2, verticalAlign: 'text-top' }}>
      {n}
    </button>
  )
}

function Line({ s, picked, onPick, facts, strong }: { s: Sentence; picked: number | null; onPick: (n: number) => void; facts: Map<number, Fact>; strong?: boolean }) {
  return (
    <div style={{ overflowWrap: 'anywhere', lineHeight: 1.55, ...(strong ? { fontSize: 13, color: 'var(--text-primary)' } : {}) }}>
      {s.text}
      {s.cites.map(c => <Cite key={c} n={c} picked={picked === c} onPick={onPick} fact={facts.get(c)} />)}
    </div>
  )
}

export default function ResearchPage() {
  const { mode } = useMode()
  const market = mode === 'INDIA' ? 'IN' : 'US'
  const [question, setQuestion] = useState('')
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // "Research this" links pre-fill the question (?q=…); the user asks.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setQuestion(q.slice(0, 300))
    input.current?.focus()
  }, [])

  const ask = useCallback(async (q: string) => {
    const text = q.trim()
    if (!text) return
    setQuestion(text); setLoading(true); setError(''); setData(null); setPicked(null)
    try {
      const r = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, market }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) setError('Sign in to ask the Research Agent.')
      else if (!r.ok) setError(j.error ?? 'Could not answer that right now. Try again in a minute.')
      else setData(j)
    } catch { setError('Network error — check your connection and try again.') } finally { setLoading(false) }
  }, [market])

  const facts = new Map((data?.facts ?? []).map(f => [f.id, f]))
  const pick = (n: number) => setPicked(p => (p === n ? null : n))
  const pf = picked != null ? facts.get(picked) : undefined
  const a = data?.answer

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', background: 'var(--bg-terminal)', minHeight: '100%', color: 'var(--text-primary)', fontSize: 11 }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.1em' }}>RESEARCH AGENT — {market === 'US' ? 'USA' : 'INDIA'}</div>
        <div style={{ ...meta, marginTop: 2 }}>Ask why something moved, what if a factor moves, how companies connect, or what is driving the market · every sentence cites its facts · explains moves, never gives buy/sell advice</div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1100 }}>
        <form onSubmit={e => { e.preventDefault(); ask(question) }} style={{ ...box, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={input} value={question} onChange={e => setQuestion(e.target.value)} maxLength={300} aria-label="Your question"
            placeholder={EXAMPLES[market][0]}
            style={{ flex: 1, minWidth: 0, background: 'var(--bg-terminal)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: 12, padding: '6px 8px' }} />
          <button type="submit" disabled={loading || !question.trim()}
            style={{ background: 'transparent', color: loading || !question.trim() ? 'var(--text-muted)' : 'var(--text-accent)', border: '1px solid currentColor', fontFamily: 'inherit', fontSize: 11, padding: '6px 14px', cursor: loading ? 'wait' : 'pointer' }}>ASK</button>
        </form>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EXAMPLES[market].map(q => (
            <button key={q} onClick={() => ask(q)} disabled={loading}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 10, padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: 10, color: 'var(--text-secondary)' }}>{q}</button>
          ))}
        </div>

        {loading && <div style={{ ...box, color: 'var(--text-accent)' }}>GATHERING FACTS…</div>}
        {!loading && error && <div style={{ ...box, color: 'var(--text-negative)' }}>{error}</div>}

        {!loading && a && data && (
          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '0 5px', border: `1px solid ${data.mode === 'ai' ? '#a78bfa' : '#38bdf8'}`, color: data.mode === 'ai' ? '#a78bfa' : '#38bdf8', borderRadius: 2 }}>
                {data.mode === 'ai' ? 'AI' : 'AUTOMATIC'}
              </span>
              <span style={meta}>{data.mode === 'ai' && a.ai ? a.ai.label : a.label}</span>
              {a.kind === 'answer' && <span style={{ marginLeft: 'auto' }}><DataStatusBadge status={data.dataStatus.status} asOf={data.dataStatus.asOf} source={data.dataStatus.note} /></span>}
            </div>

            {data.mode === 'ai' && a.ai
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{a.ai.sentences.map((s, i) => <Line key={i} s={s} picked={picked} onPick={pick} facts={facts} strong />)}</div>
              : <Line s={a.headline} picked={picked} onPick={pick} facts={facts} strong />}
            {a.notes.map((n, i) => <div key={i} style={{ ...meta, color: 'var(--text-warning)' }}>{n}</div>)}

            {pf && (
              <div style={{ border: '1px solid var(--text-accent)', padding: '6px 8px', background: 'var(--bg-terminal)' }}>
                <div style={head}>FACT {pf.id}</div>
                <div style={{ overflowWrap: 'anywhere' }}>{pf.text}</div>
                <div style={{ ...meta, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {pf.source.url ? <a href={pf.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{pf.source.name}</a> : <span>{pf.source.name}</span>}
                  {pf.source.asOf != null && <span>{when(pf.source.asOf)}</span>}
                  <DataStatusBadge status={pf.status} asOf={typeof pf.source.asOf === 'number' ? pf.source.asOf : null} source={pf.source.name} />
                </div>
              </div>
            )}

            {data.mode === 'ai' && <div style={{ ...head, marginBottom: 0 }}>THE FACTS BEHIND IT</div>}
            {a.sections.map(sec => (
              <div key={sec.key}>
                <div style={head}>{sec.title.toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: sec.key === 'cant' ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {sec.sentences.map((s, i) => <Line key={i} s={s} picked={picked} onPick={pick} facts={facts} />)}
                </div>
              </div>
            ))}

            {a.sources.length > 0 && (
              <div>
                <div style={head}>SOURCES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {a.sources.map(s => (
                    <div key={s.n} style={{ ...meta, overflowWrap: 'anywhere' }}>
                      {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{s.name}</a> : <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>}
                      {s.asOf != null && ` · ${when(s.asOf)}`} · facts {s.facts.map(f => <Cite key={f} n={f} picked={picked === f} onPick={pick} fact={facts.get(f)} />)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={meta}>Answered in {(data.timings.totalMs / 1000).toFixed(1)} s · correlation, not proof of cause · not investment advice</div>
          </div>
        )}
      </div>
    </div>
  )
}
