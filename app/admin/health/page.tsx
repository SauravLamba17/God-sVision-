import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { feedSnapshot, instanceStartedAt, instanceId, mergeFeeds, type FeedStats, type InstanceSummary } from '@/lib/feedHealth'
import { DAILY_CAP } from '@/lib/gemini'

// Admin-only data health page. Access is checked here, server-side, against
// ADMIN_EMAILS (comma-separated) — not in middleware or auth config. Anyone
// signed in but not listed gets a 404; signed-out visitors are sent to sign-in
// by the existing middleware before reaching this page.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Data health', robots: { index: false, follow: false } }

// Feeds the app uses, so ones not yet called on this instance still appear.
const EXPECTED = [
  'Yahoo Finance', 'Yahoo Finance (yahoo-finance2)', 'Alpaca (IEX)', 'CoinGecko', 'NSE India', 'FRED', 'OpenSky',
  'USGS', 'WHO', 'Open-Meteo', 'OpenWeather', 'NewsAPI', 'Nasdaq', 'disease.sh', 'ISS position', 'ISS crew',
  'Reddit', 'TheSportsDB', 'Windy', 'Gemini',
]

const isAdmin = (email?: string | null) =>
  !!email && (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())

const ago = (t: number | null) => {
  if (!t) return '—'
  const s = Math.round((Date.now() - t) / 1000)
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`
}
const fmt = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' ET'

function statusOf(f?: FeedStats): { label: string; color: string } {
  if (!f) return { label: 'NO CALLS YET', color: 'var(--text-muted)' }
  if (f.lastErrorAt && (!f.lastOkAt || f.lastErrorAt > f.lastOkAt)) return { label: 'FAILING', color: 'var(--text-negative)' }
  if (f.failures > 0) return { label: 'OK (RECENT ERRORS)', color: 'var(--text-warning)' }
  return { label: 'OK', color: 'var(--text-positive)' }
}

const cell: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--border-color)', textAlign: 'left', verticalAlign: 'top' }
const head: React.CSSProperties = { ...cell, color: 'var(--text-muted)', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em' }
const section: React.CSSProperties = { border: '1px solid var(--border-color)', background: 'var(--bg-panel)', marginBottom: 10, overflowX: 'auto' }
const title: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-accent)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }

export default async function HealthPage() {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.email)) notFound()

  // Existing rows only — this page adds reads, never writes.
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const [budget, aiRows, rlRows, healthRows] = await Promise.all([
    prisma.cachedData.findMany({ where: { key: { startsWith: `gemini_budget:${day}:` } } }),
    prisma.cachedData.findMany({ where: { key: { startsWith: 'ai:' } }, orderBy: { key: 'asc' } }),
    prisma.cachedData.findMany({ where: { key: { startsWith: 'rl:' }, expiresAt: { gt: new Date() } }, select: { key: true, value: true } }),
    prisma.cachedData.findMany({ where: { key: { startsWith: 'health:' }, expiresAt: { gt: new Date() } } }),
  ])
  const used = (kind: 'scheduled' | 'ondemand') => Number(budget.find(b => b.key.endsWith(`:${kind}`))?.value ?? 0)

  // Other instances' last reported summaries + this instance's live numbers
  // (its own stored summary is skipped — the live view is newer).
  const instances: InstanceSummary[] = healthRows
    .map(r => { try { return JSON.parse(r.value) as InstanceSummary } catch { return null } })
    .filter((s): s is InstanceSummary => !!s && s.instanceId !== instanceId)
  const seen = new Map(mergeFeeds([feedSnapshot(), ...instances.map(i => i.feeds)]).map(f => [f.feed, f]))
  const names = [...new Set([...EXPECTED, ...seen.keys()])].sort((a, b) => a.localeCompare(b))

  // Rate-limit counters, summarised per bucket (no per-user/IP detail shown).
  const buckets = new Map<string, { counters: number; hits: number }>()
  for (const r of rlRows) {
    const b = r.key.split(':')[1]
    const e = buckets.get(b) ?? { counters: 0, hits: 0 }
    e.counters++; e.hits += Number(r.value)
    buckets.set(b, e)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-terminal)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', padding: 12, fontSize: 11 }}>
      <h1 style={{ fontSize: 14, color: 'var(--text-accent)', letterSpacing: '0.08em', margin: '0 0 4px' }}>DATA HEALTH</h1>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.6, maxWidth: 900 }}>
        Feed results are recorded passively from calls the app already makes. This view merges <b>this instance</b> (live, started {ago(instanceStartedAt)})
        with <b>{instances.length} other instance{instances.length === 1 ? '' : 's'}</b> that reported in the last hour
        {instances.length > 0 && <> (last reports: {instances.map(i => ago(i.reportedAt)).join(', ')})</>}.
        Instances report at most every 5 minutes, and only while serving write/auth/AI/Sheets requests — an instance serving only cached reads
        does not report. A feed served from cache shows its last successful call, not a fresh upstream contact.
      </p>

      <div style={section}>
        <div style={title}>GEMINI BUDGET — TODAY ({day}, Pacific)</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={head}>KIND</th><th style={head}>CALLS ALLOWED</th><th style={head}>CAP</th><th style={head}>LEFT</th><th style={head}>REFUSED (OVER CAP)</th></tr></thead>
          <tbody>
            {(['scheduled', 'ondemand'] as const).map(k => (
              <tr key={k}>
                <td style={cell}>{k}</td>
                {/* The counter also counts attempts refused once the cap is hit. */}
                <td style={cell}>{Math.min(used(k), DAILY_CAP[k])}</td>
                <td style={cell}>{DAILY_CAP[k]}</td>
                <td style={{ ...cell, color: used(k) >= DAILY_CAP[k] ? 'var(--text-negative)' : 'var(--text-positive)' }}>{Math.max(0, DAILY_CAP[k] - used(k))}</td>
                <td style={cell}>{Math.max(0, used(k) - DAILY_CAP[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={section}>
        <div style={title}>EXTERNAL FEEDS — {instances.length + 1} INSTANCE{instances.length ? 'S' : ''} MERGED</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>
            <th style={head}>FEED</th><th style={head}>STATUS</th><th style={head}>LAST SUCCESS</th><th style={head}>LAST ERROR</th>
            <th style={head}>LAST RESPONSE</th><th style={head}>CALLS / FAILED</th>
          </tr></thead>
          <tbody>
            {names.map(n => {
              const f = seen.get(n), s = statusOf(f)
              return (
                <tr key={n}>
                  <td style={cell}>{n}</td>
                  <td style={{ ...cell, color: s.color, fontWeight: 700 }}>{s.label}</td>
                  <td style={cell}>{ago(f?.lastOkAt ?? null)}</td>
                  <td style={{ ...cell, color: f?.lastError ? 'var(--text-negative)' : undefined, maxWidth: 360, wordBreak: 'break-word' }}>
                    {f?.lastErrorAt ? `${ago(f.lastErrorAt)} — ${f.lastError}` : '—'}
                  </td>
                  <td style={cell}>{f?.lastMs != null ? `${f.lastMs} ms${f.lastStatus ? ` · HTTP ${f.lastStatus}` : ''}` : '—'}</td>
                  <td style={cell}>{f ? `${f.calls} / ${f.failures}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={section}>
        <div style={title}>AI CACHE (Postgres, shared by all instances)</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={head}>KEY</th><th style={head}>GENERATED</th><th style={head}>NEXT REGENERATION AFTER</th></tr></thead>
          <tbody>
            {aiRows.length === 0 && <tr><td style={cell} colSpan={3}>No AI outputs cached yet.</td></tr>}
            {aiRows.map(r => (
              <tr key={r.key}><td style={cell}>{r.key}</td><td style={cell}>{fmt(r.updatedAt)}</td><td style={cell}>{fmt(r.expiresAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={section}>
        <div style={title}>RATE LIMITS — ACTIVE WINDOWS</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={head}>BUCKET</th><th style={head}>ACTIVE COUNTERS</th><th style={head}>REQUESTS COUNTED</th></tr></thead>
          <tbody>
            {buckets.size === 0 && <tr><td style={cell} colSpan={3}>No active rate-limit windows.</td></tr>}
            {[...buckets].sort().map(([b, e]) => (
              <tr key={b}><td style={cell}>{b}</td><td style={cell}>{e.counters}</td><td style={cell}>{e.hits}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
