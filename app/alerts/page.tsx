'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { PushSubscribe } from '@/components/terminal/PushSubscribe'
import { postJson } from '@/lib/utils'
import { tint } from '@/lib/context/ThemeContext'

interface PriceAlert { id: number; ticker: string; condition: string; targetPrice: number; triggered: boolean; active: boolean; createdAt: string; triggeredAt?: string }
interface NewsAlert  { id: number; keyword: string; active: boolean; createdAt: string }

function formatPrice(v: number) { return v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}` }

export default function AlertsPage() {
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])
  const [newsAlerts,  setNewsAlerts]  = useState<NewsAlert[]>([])
  const [loading,     setLoading]     = useState(true)
  const [notifPerm,   setNotifPerm]   = useState<NotificationPermission>('default')
  const [triggered,   setTriggered]   = useState<number[]>([])
  const [form, setForm] = useState({ ticker: '', condition: 'above', targetPrice: '', keyword: '' })
  // Which form is saving (blocks a double submit) and its error from the server.
  const [saving, setSaving] = useState({ price: false, news: false })
  const [formErr, setFormErr] = useState({ price: '', news: '' })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAlerts = useCallback(async () => {
    try {
      const res  = await fetch('/api/alerts')
      const json = await res.json()
      if (json.data) { setPriceAlerts(json.data.priceAlerts || []); setNewsAlerts(json.data.newsAlerts || []) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const checkPrices = useCallback(async () => {
    try {
      const res  = await fetch('/api/alerts?check=prices')
      const json = await res.json()
      if (json.triggered?.length) {
        setTriggered(prev => [...prev, ...json.triggered])
        loadAlerts()
        if (notifPerm === 'granted') {
          json.triggered.forEach((id: number) => {
            const alert = priceAlerts.find(a => a.id === id)
            if (!alert) return
            new Notification(`🔔 ALERT TRIGGERED`, {
              body: `${alert.ticker} is ${alert.condition} ${formatPrice(alert.targetPrice)}`,
              icon: '/favicon.ico',
              tag:  `alert-${id}`,
            })
          })
        }
      }
    } catch { /* silent */ }
  }, [priceAlerts, notifPerm, loadAlerts])

  useEffect(() => {
    loadAlerts()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission)
    }
  }, [])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => { loadAlerts(); checkPrices() }, 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loadAlerts, checkPrices])

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  const addPriceAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving.price) return
    // A rejected alert keeps the input and shows the server's message; it used to clear as if saved.
    setSaving(s => ({ ...s, price: true }))
    const msg = await postJson('/api/alerts', { type: 'price', ticker: form.ticker, condition: form.condition, targetPrice: form.targetPrice })
    setSaving(s => ({ ...s, price: false }))
    setFormErr(f => ({ ...f, price: msg ?? '' }))
    if (msg) return
    setForm(f => ({ ...f, ticker: '', targetPrice: '' }))
    loadAlerts()
  }

  const addNewsAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving.news) return
    setSaving(s => ({ ...s, news: true }))
    const msg = await postJson('/api/alerts', { type: 'news', keyword: form.keyword })
    setSaving(s => ({ ...s, news: false }))
    setFormErr(f => ({ ...f, news: msg ?? '' }))
    if (msg) return
    setForm(f => ({ ...f, keyword: '' }))
    loadAlerts()
  }

  const deleteAlert = async (id: number, type: 'price'|'news') => {
    try { await fetch(`/api/alerts?id=${id}&type=${type}`, { method: 'DELETE' }) } catch { /* list reloads below */ }
    // Reload rather than drop locally: on 404 (already gone / not yours) the UI
    // shows exactly what the server has, never removing a row that still exists.
    loadAlerts()
  }

  const activeAlerts    = priceAlerts.filter(a => a.active && !a.triggered).length
  const triggeredAlerts = priceAlerts.filter(a => a.triggered).length

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      <div className="gv-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', overflow: 'visible', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--fs-header)', fontWeight: 700, color: 'var(--text)' }}>
          PRICE ALERTS & NOTIFICATIONS
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: 'ACTIVE',    val: String(activeAlerts),       color: 'var(--text-positive)' },
              { label: 'TRIGGERED', val: String(triggeredAlerts),    color: 'var(--text-warning)' },
              { label: 'TOTAL',     val: String(priceAlerts.length), color: 'var(--text-accent)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: tint(s.color, 4), border: `var(--bw) solid ${s.color}`, borderRadius: 'var(--radius-inner)', padding: '2px 10px', minWidth: 50 }}>
                <span className="gv-num" style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</span>
                <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: notifPerm === 'granted' ? 'var(--up-soft)' : 'var(--warning-soft)', border: `var(--bw) solid ${notifPerm === 'granted' ? 'var(--up)' : 'var(--warning)'}`, borderRadius: 'var(--radius-inner)' }}>
            <span style={{ fontSize: 9, color: notifPerm === 'granted' ? 'var(--text-positive)' : 'var(--text-warning)' }}>
              {notifPerm === 'granted' ? '🔔 NOTIFICATIONS ON' : notifPerm === 'denied' ? '🔕 BLOCKED' : '🔔 NOTIFICATIONS OFF'}
            </span>
            {notifPerm !== 'granted' && notifPerm !== 'denied' && (
              <button onClick={requestNotifPermission} className="btn-terminal" style={{ fontSize: 8, padding: '1px 6px' }}>ENABLE</button>
            )}
          </div>
          <PushSubscribe />
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>● Price checks every 60 seconds — global AlertChecker running in background</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', alignSelf: 'center' }}>SOUND TEST:</span>
          {[
            { label: 'BEEP', fn: () => import('@/lib/sounds').then(s => s.playAlertBeep()) },
            { label: 'CHIME', fn: () => import('@/lib/sounds').then(s => s.playNewsChime()) },
            { label: 'WARN', fn: () => import('@/lib/sounds').then(s => s.playWarningTone()) },
            { label: 'OPEN', fn: () => import('@/lib/sounds').then(s => s.playMarketOpen()) },
          ].map(b => (
            <button key={b.label} type="button" onClick={b.fn} className="gv-tab" style={{ fontSize: 8, padding: '2px 7px' }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="gv-card" style={{ flex: 1 }}>
          <div className="panel-header"><span className="panel-header-title">ADD PRICE ALERT</span></div>
          <form onSubmit={addPriceAlert} style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[{ key:'ticker', label:'TICKER', placeholder:'AAPL', width:90 }, { key:'targetPrice', label:'PRICE ($)', placeholder:'150.00', width:100, type:'number' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: f.key==='ticker' ? e.target.value.toUpperCase() : e.target.value }))}
                  placeholder={f.placeholder} aria-label={f.label} type={f.type||'text'} step={f.type==='number' ? '0.01' : undefined} className="input-terminal" style={{ width: f.width }} required />
              </div>
            ))}
            <div>
              <label style={{ fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>CONDITION</label>
              <select value={form.condition} aria-label="Condition" onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="input-terminal" style={{ width: 100 }}>
                <option value="above">ABOVE ▲</option>
                <option value="below">BELOW ▼</option>
              </select>
            </div>
            <button type="submit" disabled={saving.price} className="btn-terminal" style={{ alignSelf:'flex-end' }}>{saving.price ? 'SAVING…' : '+ SET ALERT'}</button>
            {formErr.price && <div role="alert" style={{ flexBasis:'100%', fontSize:10, color:'var(--text-negative)' }}>{formErr.price}</div>}
          </form>
        </div>
        <div className="gv-card" style={{ width: 300, flexShrink: 0 }}>
          <div className="panel-header"><span className="panel-header-title">ADD NEWS KEYWORD</span></div>
          <form onSubmit={addNewsAlert} style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>KEYWORD</label>
              <input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} placeholder="Federal Reserve, NVDA..." aria-label="News keyword" className="input-terminal w-full" required />
            </div>
            <button type="submit" disabled={saving.news} className="btn-terminal" style={{ alignSelf:'flex-end' }}>{saving.news ? '…' : '+ ADD'}</button>
          </form>
          {formErr.news && <div role="alert" style={{ padding:'0 12px 8px', fontSize:10, color:'var(--text-negative)' }}>{formErr.news}</div>}
        </div>
      </div>

      <div className="gv-card">
        <div className="panel-header">
          <span className="panel-header-title">PRICE ALERTS ({priceAlerts.length})</span>
          <span style={{ fontSize:9, color:'var(--text-positive)' }}>● MONITORING {activeAlerts} ACTIVE</span>
        </div>
        {loading ? (
          <div style={{ fontSize:10, color:'var(--text-accent)', padding:16 }}>LOADING<span className="blink-cursor" /></div>
        ) : priceAlerts.length === 0 ? (
          <div style={{ fontSize:10, color:'var(--text-muted)', padding:24, textAlign:'center' }}>NO ALERTS — SET ONE ABOVE</div>
        ) : (
          <table className="data-table">
            <thead><tr><th style={{ textAlign:'left' }}>TICKER</th><th>CONDITION</th><th>TARGET PRICE</th><th>STATUS</th><th>CREATED</th><th>TRIGGERED AT</th><th></th></tr></thead>
            <tbody>
              {priceAlerts.map(a => (
                <tr key={a.id} style={{ background: triggered.includes(a.id) ? 'var(--warning-soft)' : undefined }}>
                  <td style={{ textAlign:'left', color:'var(--text-accent)', fontWeight:700 }}>{a.ticker}</td>
                  <td style={{ color: a.condition==='above' ? 'var(--text-positive)' : 'var(--text-negative)' }}>{a.condition==='above' ? '▲ ABOVE' : '▼ BELOW'}</td>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{formatPrice(a.targetPrice)}</td>
                  <td>
                    <span style={{ padding:'1px 6px', borderRadius:4, fontSize:9, fontWeight:700, fontFamily:'var(--font-sans)',
                      background: a.triggered ? 'var(--warning-soft)' : a.active ? 'var(--up-soft)' : 'transparent',
                      color:      a.triggered ? 'var(--text-warning)' : a.active ? 'var(--text-positive)' : 'var(--text-muted)',
                      border: 'var(--bw) solid currentColor',
                    }}>
                      {a.triggered ? '🔔 TRIGGERED' : a.active ? '● WATCHING' : '○ INACTIVE'}
                    </span>
                  </td>
                  <td style={{ color:'var(--text-muted)', fontSize:9 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td style={{ color:'var(--text-warning)', fontSize:9 }}>{a.triggeredAt ? new Date(a.triggeredAt).toLocaleString() : '—'}</td>
                  <td><button onClick={() => deleteAlert(a.id,'price')} aria-label={`Delete ${a.ticker} alert`} title="Delete alert" style={{ background:'none', border:'none', color:'var(--text-negative)', cursor:'pointer', fontSize:12 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {newsAlerts.length > 0 && (
        <div className="gv-card">
          <div className="panel-header"><span className="panel-header-title">NEWS KEYWORD ALERTS ({newsAlerts.length})</span></div>
          <table className="data-table">
            <thead><tr><th style={{ textAlign:'left' }}>KEYWORD</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead>
            <tbody>
              {newsAlerts.map(a => (
                <tr key={a.id}>
                  <td style={{ textAlign:'left', color:'var(--text-primary)', fontWeight:600 }}>{a.keyword}</td>
                  <td><span style={{ padding:'1px 6px', borderRadius:4, fontSize:9, fontFamily:'var(--font-sans)', background:'var(--up-soft)', color:'var(--text-positive)', border:'var(--bw) solid currentColor' }}>● ACTIVE</span></td>
                  <td style={{ color:'var(--text-muted)', fontSize:9 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td><button onClick={() => deleteAlert(a.id,'news')} aria-label={`Delete "${a.keyword}" alert`} title="Delete alert" style={{ background:'none', border:'none', color:'var(--text-negative)', cursor:'pointer', fontSize:12 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
