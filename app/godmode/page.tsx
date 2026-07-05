'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBinanceStream } from '@/lib/hooks/useBinanceStream'
import { formatCurrency, formatPercent } from '@/lib/utils'
import dynamic from 'next/dynamic'

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false })

const SCENES = ['WORLD MAP','MARKET PULSE','CRYPTO MATRIX','BTC CHART','EARTHQUAKE WATCH','GLOBAL NEWS']
const SCENE_DURATION = 30000

interface Mover { symbol: string; changePct: number; price: number; name?: string }
interface Quake { id: string; magnitude: number; place: string; time: number; lat: number; lng: number }
interface NewsItem { title: string; source: string; publishedAt: string }
interface CryptoItem { symbol: string; name: string; current_price: number; price_change_percentage_24h: number }

// Each scene rendered as a component

function SceneWorldMap() {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'var(--bg-terminal)' }}>
      <iframe src="/map" style={{ width:'100%', height:'100%', border:'none' }} title="World Map" />
      <div style={{ position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--text-accent)', textAlign:'center', background:'rgba(0,0,0,0.7)', padding:'4px 16px', borderRadius:2 }}>
        LIVE GLOBAL MAP â€” FLIGHTS Â· EARTHQUAKES Â· ISS
      </div>
    </div>
  )
}

function SceneMarketPulse({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', height:'100%', gap:2 }}>
      <div style={{ background:'rgba(34,197,94,0.04)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 40px' }}>
        <div style={{ fontFamily:'IBM Plex Mono', fontSize:14, color:'var(--text-positive)', letterSpacing:'0.2em', marginBottom:24 }}>TOP GAINERS</div>
        {gainers.map((m, i) => (
          <div key={m.symbol} style={{ display:'flex', justifyContent:'space-between', width:'100%', marginBottom:16, alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:28, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{m.symbol}</div>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{formatCurrency(m.price)}</div>
            </div>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:48, fontWeight:700, color:'var(--text-positive)', lineHeight:1 }}>
              +{m.changePct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(239,68,68,0.04)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 40px' }}>
        <div style={{ fontFamily:'IBM Plex Mono', fontSize:14, color:'var(--text-negative)', letterSpacing:'0.2em', marginBottom:24 }}>TOP LOSERS</div>
        {losers.map((m, i) => (
          <div key={m.symbol} style={{ display:'flex', justifyContent:'space-between', width:'100%', marginBottom:16, alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:28, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{m.symbol}</div>
              <div style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{formatCurrency(m.price)}</div>
            </div>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:48, fontWeight:700, color:'var(--text-negative)', lineHeight:1 }}>
              {m.changePct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SceneCryptoMatrix({ coins, tickers }: { coins: CryptoItem[]; tickers: Map<string, any> }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:2, padding:8, height:'100%', alignContent:'start' }}>
      {coins.slice(0, 20).map(coin => {
        const bt = tickers.get(coin.symbol.toUpperCase() + 'USDT')
        const price = bt?.price ?? coin.current_price
        const changePct = bt?.changePct ?? coin.price_change_percentage_24h
        const isPos = changePct >= 0
        return (
          <div key={coin.symbol} style={{
            border: `1px solid ${isPos ? '#22c55e30' : '#ef444430'}`,
            background: isPos ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            padding:'16px 8px',
          }}>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:16, fontWeight:700, color: isPos ? 'var(--text-positive)' : 'var(--text-negative)', letterSpacing:'0.06em' }}>
              {coin.symbol.toUpperCase()}
            </div>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:14, color:'var(--text-primary)', marginTop:4 }}>
              {price < 1 ? `$${price.toFixed(4)}` : formatCurrency(price)}
            </div>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:18, fontWeight:700, color: isPos ? 'var(--text-positive)' : 'var(--text-negative)', marginTop:4 }}>
              {isPos ? '+' : ''}{changePct.toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SceneBTCChart({ candles }: { candles: any[] }) {
  return (
    <div style={{ height:'100%', padding:0 }}>
      {candles.length > 0
        ? <CandlestickChart candles={candles} height={typeof window !== 'undefined' ? window.innerHeight : 800} showVolume />
        : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontFamily:'IBM Plex Mono', fontSize:14, color:'var(--text-accent)' }}>LOADING BTC CHART...</div>
      }
    </div>
  )
}

function SceneEarthquakeWatch({ quakes }: { quakes: Quake[] }) {
  const majors = quakes.filter(q => q.magnitude >= 4.5)
  return (
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', height:'100%', gap:2 }}>
      <div style={{ position:'relative' }}>
        <iframe src="/map" style={{ width:'100%', height:'100%', border:'none' }} title="Earthquake Map" />
      </div>
      <div style={{ background:'var(--bg-terminal)', padding:'20px 16px', overflowY:'auto' }}>
        <div style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--text-negative)', letterSpacing:'0.2em', marginBottom:16 }}>EARTHQUAKE WATCH</div>
        {majors.slice(0, 15).map(q => (
          <div key={q.id} style={{ marginBottom:12, padding:'8px 0', borderBottom:'1px solid #1b2e1b' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{
                fontFamily:'IBM Plex Mono', fontSize:18, fontWeight:700,
                color: q.magnitude >= 7 ? 'var(--text-negative)' : q.magnitude >= 6 ? 'var(--text-warning)' : 'var(--text-primary)',
              }}>M{q.magnitude.toFixed(1)}</span>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:'var(--text-muted)' }}>{q.place}</span>
            </div>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)' }}>
              {new Date(q.time).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SceneGlobalNews({ news }: { news: NewsItem[] }) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setOffset(prev => prev + 1), 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ height:'100%', overflow:'hidden', padding:'0 40px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
      <div style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--text-accent)', letterSpacing:'0.3em', marginBottom:20, textAlign:'center' }}>
        GLOBAL NEWS FEED â€” LIVE
      </div>
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        <div style={{ transform:`translateY(-${offset}px)`, transition:'none' }}>
          {[...news, ...news].map((item, i) => (
            <div key={i} style={{ padding:'12px 0', borderBottom:'1px solid #1b2e1b' }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                <span style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:'var(--text-accent)', flexShrink:0, minWidth:120 }}>
                  {item.source}
                </span>
                <span style={{ fontFamily:'IBM Plex Mono', fontSize:14, color:'var(--text-primary)', lineHeight:1.4 }}>
                  {item.title}
                </span>
                <span style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:'var(--text-muted)', flexShrink:0 }}>
                  {new Date(item.publishedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GodModePage() {
  const router = useRouter()
  const [scene, setScene] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers, setLosers] = useState<Mover[]>([])
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [coins, setCoins] = useState<CryptoItem[]>([])
  const [btcCandles, setBtcCandles] = useState<any[]>([])

  const binanceTickers = useBinanceStream()
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sceneRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sceneIdx = useRef(0)

  const goToScene = useCallback((idx: number) => {
    setTransitioning(true)
    setTimeout(() => {
      sceneIdx.current = idx % SCENES.length
      setScene(sceneIdx.current)
      setProgress(0)
      setTransitioning(false)
    }, 500)
  }, [])

  // Scene rotation
  useEffect(() => {
    const startTimer = () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (sceneRef.current) clearTimeout(sceneRef.current)

      progressRef.current = setInterval(() => {
        setProgress(p => p + (100 / (SCENE_DURATION / 100)))
      }, 100)

      sceneRef.current = setTimeout(() => {
        goToScene(sceneIdx.current + 1)
        startTimer()
      }, SCENE_DURATION)
    }
    startTimer()
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (sceneRef.current) clearTimeout(sceneRef.current)
    }
  }, [goToScene])

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      const [moversRes, quakesRes, newsRes, cryptoRes, btcRes] = await Promise.allSettled([
        fetch('/api/stocks?type=movers'),
        fetch('/api/earthquakes?minMag=4.0'),
        fetch('/api/news'),
        fetch('/api/crypto?type=top100'),
        fetch('/api/crypto?type=chart&coin=bitcoin&days=30'),
      ])
      if (moversRes.status==='fulfilled') {
        const j = await moversRes.value.json()
        setGainers((j.data?.gainers || []).slice(0,5))
        setLosers((j.data?.losers || []).slice(0,5))
      }
      if (quakesRes.status==='fulfilled') {
        const j = await quakesRes.value.json()
        if (j.data) {
          setQuakes(j.data)
          // Play warning if M >= 6
          const bigOne = j.data.find((q: Quake) => q.magnitude >= 6.0 && (Date.now() - q.time) < 60000)
          if (bigOne) {
            import('@/lib/sounds').then(s => s.playWarningTone())
            goToScene(4) // Switch to earthquake scene
          }
        }
      }
      if (newsRes.status==='fulfilled') {
        const j = await newsRes.value.json()
        if (j.data) setNews(j.data.slice(0,20))
      }
      if (cryptoRes.status==='fulfilled') {
        const j = await cryptoRes.value.json()
        if (j.data) setCoins(j.data.slice(0,20))
      }
      if (btcRes.status==='fulfilled') {
        const j = await btcRes.value.json()
        if (j.data) {
          setBtcCandles(j.data.map((d: [number,number,number,number,number]) => ({
            time: Math.floor(d[0] / 1000), open: d[1], high: d[2], low: d[3], close: d[4],
          })))
        }
      }
    }
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [goToScene])

  // Exit handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') router.back()
      if (e.key >= '1' && e.key <= '6') goToScene(parseInt(e.key) - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, goToScene])

  const sceneContent = () => {
    switch (scene) {
      case 0: return <SceneWorldMap />
      case 1: return <SceneMarketPulse gainers={gainers} losers={losers} />
      case 2: return <SceneCryptoMatrix coins={coins} tickers={binanceTickers} />
      case 3: return <SceneBTCChart candles={btcCandles} />
      case 4: return <SceneEarthquakeWatch quakes={quakes} />
      case 5: return <SceneGlobalNews news={news} />
      default: return null
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'var(--bg-terminal)', zIndex:9999,
      display:'flex', flexDirection:'column',
      opacity: transitioning ? 0 : 1,
      transition:'opacity 0.5s ease',
    }}>
      {/* Scene content */}
      <div style={{ flex:1, overflow:'hidden' }}>
        {sceneContent()}
      </div>

      {/* Progress bar */}
      <div style={{ position:'absolute', bottom:0, left:0, height:4, background:'var(--border-color)', width:'100%' }}>
        <div style={{ height:'100%', background:'var(--text-accent)', width:`${progress}%`, transition:'width 0.1s linear' }} />
      </div>

      {/* Scene dots */}
      <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
        {SCENES.map((_, i) => (
          <button key={i} onClick={() => { setProgress(0); goToScene(i) }}
            style={{ width: i===scene?12:6, height:6, borderRadius:3, background: i===scene?'var(--text-accent)':'var(--border-color)', border:'none', cursor:'pointer', transition:'all 0.3s' }} />
        ))}
      </div>

      {/* Scene label */}
      <div style={{ position:'absolute', top:12, right:16, fontFamily:'IBM Plex Mono', fontSize:10, color:'var(--text-accent)', letterSpacing:'0.15em', opacity:0.7 }}>
        {SCENES[scene]} â€” PRESS ESC TO EXIT Â· 1-6 TO JUMP
      </div>
    </div>
  )
}
