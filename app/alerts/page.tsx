'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { PushSubscribe } from '@/components/terminal/PushSubscribe'

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
    intervalRef.current = setInterval(() => { loadAlerts(); checkPrices() }, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loadAlerts, checkPrices])

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  const addPriceAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'price', ticker: form.ticker, condition: form.condition, targetPrice: form.targetPrice }) })
    setForm(f => ({ ...f, ticker: '', targetPrice: '' }))
    loadAlerts()
  }

  const addNewsAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'news', keyword: form.keyword }) })
    setForm(f => ({ ...f, keyword: '' }))
    loadAlerts()
  }

  const deleteAlert = async (id: number, type: 'price'|'news') => {
    await fetch(`/api/alerts?id=${id}&type=${type}`, { method: 'DELETE' })
    loadAlerts()
  }

  const activeAlerts    = priceAlerts.filter(a => a.active && !a.triggered).length
  const triggeredAlerts = priceAlerts.filter(a => a.triggered).length

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-header)', border: '1px solid #1e293b', borderLeft: '2px solid #f59e0b', padding: '6px 12px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 700, color: 'var(--text-warning)', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(245,158,11,0.4)' }}>
          PRICE ALERTS & NOTIFICATIONS
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: 'ACTIVE',    val: String(activeAlerts),       color: 'var(--text-positive)' },
              { label: 'TRIGGERED', val: String(triggeredAlerts),    color: 'var(--text-warning)' },
              { label: 'TOTAL',     val: String(priceAlerts.length), color: 'var(--text-accent)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: `${s.color}0a`, border: `1px solid ${s.color}25`, borderRadius: 4, padding: '2px 10px', minWidth: 50 }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: notifPerm === 'granted' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${notifPerm === 'granted' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 4 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: notifPerm === 'granted' ? 'var(--text-positive)' : 'var(--text-warning)' }}>
              {notifPerm === 'granted' ? '🔔 NOTIFICATIONS ON' : notifPerm === 'denied' ? '🔕 BLOCKED' : '🔔 NOTIFICATIONS OFF'}
            </span>
            {notifPerm !== 'granted' && notifPerm !== 'denied' && (
              <button onClick={requestNotifPermission} className="btn-terminal" style={{ fontSize: 8, padding: '1px 6px' }}>ENABLE</button>
            )}
          </div>
          <PushSubscribe />
        </div>
      </div>

      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>● Price checks every 30 seconds — global AlertChecker running in background</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', alignSelf: 'center' }}>SOUND TEST:</span>
          {[
            { label: 'BEEP', fn: () => import('@/lib/sounds').then(s => s.playAlertBeep()) },
            { label: 'CHIME', fn: () => import('@/lib/sounds').then(s => s.playNewsChime()) },
            { label: 'WARN', fn: () => import('@/lib/sounds').then(s => s.playWarningTone()) },
            { label: 'OPEN', fn: () => import('@/lib/sounds').then(s => s.playMarketOpen()) },
          ].map(b => (
            <button key={b.label} onClick={b.fn}
              style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 7px', background: 'var(--bg-panel)', color: 'var(--text-accent)', border: '1px solid #1b2e1b', borderRadius: 2, cursor: 'pointer' }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header"><span className="panel-header-title">ADD PRICE ALERT</span></div>
          <form onSubmit={addPriceAlert} style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[{ key:'ticker', label:'TICKER', placeholder:'AAPL', width:90 }, { key:'targetPrice', label:'PRICE ($)', placeholder:'150.00', width:100, type:'number' }].map(f => (
              <div key={f.key}>
                <label style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: f.key==='ticker' ? e.target.value.toUpperCase() : e.target.value }))}
                  placeholder={f.placeholder} type={f.type||'text'} step={f.type==='number' ? '0.01' : undefined} className="input-terminal" style={{ width: f.width }} required />
              </div>
            ))}
            <div>
              <label style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>CONDITION</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="input-terminal" style={{ width: 100 }}>
                <option value="above">ABOVE ▲</option>
                <option value="below">BELOW ▼</option>
              </select>
            </div>
            <button type="submit" className="btn-terminal" style={{ alignSelf:'flex-end' }}>+ SET ALERT</button>
          </form>
        </div>
        <div style={{ width: 300, flexShrink: 0, border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header"><span className="panel-header-title">ADD NEWS KEYWORD</span></div>
          <form onSubmit={addNewsAlert} style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex:1 }}>
              <label style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', display:'block', marginBottom:3 }}>KEYWORD</label>
              <input value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} placeholder="Federal Reserve, NVDA..." className="input-terminal w-full" required />
            </div>
            <button type="submit" className="btn-terminal" style={{ alignSelf:'flex-end' }}>+ ADD</button>
          </form>
        </div>
      </div>

      <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
        <div className="panel-header">
          <span className="panel-header-title">PRICE ALERTS ({priceAlerts.length})</span>
          <span style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-positive)' }}>● MONITORING {activeAlerts} ACTIVE</span>
        </div>
        {loading ? (
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:'var(--text-accent)', padding:16 }}>LOADING<span className="blink-cursor" /></div>
        ) : priceAlerts.length === 0 ? (
          <div style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:'var(--text-muted)', padding:24, textAlign:'center' }}>NO ALERTS — SET ONE ABOVE</div>
        ) : (
          <table className="data-table">
            <thead><tr><th style={{ textAlign:'left' }}>TICKER</th><th>CONDITION</th><th>TARGET PRICE</th><th>STATUS</th><th>CREATED</th><th>TRIGGERED AT</th><th></th></tr></thead>
            <tbody>
              {priceAlerts.map(a => (
                <tr key={a.id} style={{ background: triggered.includes(a.id) ? 'rgba(245,158,11,0.06)' : undefined }}>
                  <td style={{ textAlign:'left', color:'var(--text-accent)', fontWeight:700 }}>{a.ticker}</td>
                  <td style={{ color: a.condition==='above' ? 'var(--text-positive)' : 'var(--text-negative)' }}>{a.condition==='above' ? '▲ ABOVE' : '▼ BELOW'}</td>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{formatPrice(a.targetPrice)}</td>
                  <td>
                    <span style={{ padding:'2px 6px', borderRadius:3, fontSize:9, fontWeight:700,
                      background: a.triggered ? 'rgba(245,158,11,0.15)' : a.active ? 'rgba(34,197,94,0.15)' : 'rgba(71,85,105,0.15)',
                      color:      a.triggered ? 'var(--text-warning)' : a.active ? 'var(--text-positive)' : 'var(--text-muted)',
                      border:`1px solid ${a.triggered ? 'rgba(245,158,11,0.4)' : a.active ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`,
                    }}>
                      {a.triggered ? '🔔 TRIGGERED' : a.active ? '● WATCHING' : '○ INACTIVE'}
                    </span>
                  </td>
                  <td style={{ color:'var(--text-muted)', fontSize:9 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td style={{ color:'var(--text-warning)', fontSize:9 }}>{a.triggeredAt ? new Date(a.triggeredAt).toLocaleString() : '—'}</td>
                  <td><button onClick={() => deleteAlert(a.id,'price')} style={{ background:'none', border:'none', color:'var(--text-negative)', cursor:'pointer', fontSize:12 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {newsAlerts.length > 0 && (
        <div style={{ border: '1px solid #1e293b', background: 'var(--bg-panel)' }}>
          <div className="panel-header"><span className="panel-header-title">NEWS KEYWORD ALERTS ({newsAlerts.length})</span></div>
          <table className="data-table">
            <thead><tr><th style={{ textAlign:'left' }}>KEYWORD</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead>
            <tbody>
              {newsAlerts.map(a => (
                <tr key={a.id}>
                  <td style={{ textAlign:'left', color:'var(--text-primary)', fontWeight:600 }}>{a.keyword}</td>
                  <td><span style={{ padding:'2px 6px', borderRadius:3, fontSize:9, background:'rgba(34,197,94,0.15)', color:'var(--text-positive)', border:'1px solid rgba(34,197,94,0.4)' }}>● ACTIVE</span></td>
                  <td style={{ color:'var(--text-muted)', fontSize:9 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td><button onClick={() => deleteAlert(a.id,'news')} style={{ background:'none', border:'none', color:'var(--text-negative)', cursor:'pointer', fontSize:12 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
