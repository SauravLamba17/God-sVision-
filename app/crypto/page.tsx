'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import PanelWrapper from '@/components/panels/PanelWrapper'
import AIButton from '@/components/terminal/AIButton'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import Sparkline from '@/components/charts/Sparkline'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useBinanceStream } from '@/lib/hooks/useBinanceStream'
import { useFlash } from '@/lib/hooks/useFlash'

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false })

interface Coin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency: number
  market_cap: number
  total_volume: number
  market_cap_rank: number
  sparkline_in_7d?: { price: number[] }
}

interface FearGreed {
  value: string
  value_classification: string
  timestamp: string
}

interface DeFiProtocol {
  name: string
  tvl: number
  symbol: string
  change_1d: number
}

function FearGreedGauge({ value }: { value: number }) {
  const getColor = (v: number) => v >= 75 ? 'var(--text-negative)' : v >= 55 ? 'var(--text-accent)' : v >= 45 ? '#ffd600' : v >= 25 ? 'var(--text-positive)' : '#2196f3'
  const getLabel = (v: number) => v >= 75 ? 'EXTREME GREED' : v >= 55 ? 'GREED' : v >= 45 ? 'NEUTRAL' : v >= 25 ? 'FEAR' : 'EXTREME FEAR'
  const rotation = (value / 100) * 180 - 90
  return (
    <div className="flex flex-col items-center py-3">
      <div className="relative" style={{ width: 120, height: 70 }}>
        <svg viewBox="0 0 120 65" width={120} height={65}>
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#1b2e1b" strokeWidth="12" />
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={getColor(value)} strokeWidth="12"
            strokeDasharray={`${(value / 100) * 157} 157`} />
          <line x1="60" y1="60" x2="60" y2="20"
            transform={`rotate(${rotation}, 60, 60)`}
            stroke="#c8e6c9" strokeWidth="2" strokeLinecap="round" />
          <circle cx="60" cy="60" r="4" fill="#c8e6c9" />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="font-mono text-[20px] font-bold" style={{ color: getColor(value) }}>{value}</span>
        </div>
      </div>
      <span className="font-mono text-[11px] font-bold mt-1" style={{ color: getColor(value) }}>
        {getLabel(value)}
      </span>
    </div>
  )
}

// Separate component so each row can call useFlash independently
function CoinRow({
  coin,
  isSelected,
  onSelect,
  binancePrice,
  binanceChangePct,
}: {
  coin: Coin
  isSelected: boolean
  onSelect: () => void
  binancePrice?: number
  binanceChangePct?: number
}) {
  const livePrice = binancePrice ?? coin.current_price
  const liveChangePct = binanceChangePct ?? coin.price_change_percentage_24h
  const flash = useFlash(livePrice)

  const flashBg = flash === 'up' ? 'rgba(34,197,94,0.12)' : flash === 'down' ? 'rgba(239,68,68,0.12)' : 'transparent'
  const flashColor = flash === 'up' ? 'var(--text-positive)' : flash === 'down' ? 'var(--text-negative)' : undefined

  return (
    <tr
      onClick={onSelect}
      style={{ cursor: 'pointer', background: isSelected ? '#0a140a' : 'transparent' }}
    >
      <td className="text-muted">{coin.market_cap_rank}</td>
      <td style={{ textAlign: 'left' }}>
        <span className={`font-bold ${isSelected ? 'text-accent' : 'text-primary'}`}>
          {coin.symbol.toUpperCase()}
        </span>
        <span className="text-muted ml-1 text-[9px]">{coin.name.slice(0, 12)}</span>
      </td>
      <td
        className="font-mono"
        style={{
          background: flashBg,
          color: flashColor,
          transition: flash ? 'none' : 'background 0.4s, color 0.4s',
        }}
      >
        {livePrice >= 1 ? formatCurrency(livePrice) : `$${livePrice.toFixed(6)}`}
      </td>
      <td className={liveChangePct >= 0 ? 'positive' : 'negative'}>
        {formatPercent(liveChangePct)}
      </td>
      <td className={coin.price_change_percentage_7d_in_currency >= 0 ? 'positive' : 'negative'}>
        {formatPercent(coin.price_change_percentage_7d_in_currency)}
      </td>
      <td className="text-neutral">{formatNumber(coin.market_cap)}</td>
      <td>
        <Sparkline
          data={coin.sparkline_in_7d?.price?.slice(-20) || []}
          positive={liveChangePct >= 0}
          width={60}
          height={24}
        />
      </td>
    </tr>
  )
}

export default function CryptoPage() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null)
  const [chartData, setChartData] = useState<{ time: number; open: number; high: number; low: number; close: number }[]>([])
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null)
  const [defi, setDefi] = useState<DeFiProtocol[]>([])
  const [trending, setTrending] = useState<{ item: { name: string; symbol: string; price_btc: number } }[]>([])
  const [globalData, setGlobalData] = useState<{ total_market_cap?: { usd: number }; market_cap_percentage?: { btc: number; eth: number } } | null>(null)
  const [halving, setHalving] = useState({ days: 0, hours: 0, minutes: 0 })
  const [loading, setLoading] = useState(true)

  // Binance real-time WebSocket stream (symbol → ticker)
  const binanceTickers = useBinanceStream()

  useEffect(() => {
    const fetchAll = async () => {
      const [coinsRes, fgRes, defiRes, trendRes, globalRes, halvingRes] = await Promise.allSettled([
        fetch('/api/crypto?type=top100'),
        fetch('/api/crypto?type=feargreed'),
        fetch('/api/crypto?type=defi'),
        fetch('/api/crypto?type=trending'),
        fetch('/api/crypto?type=global'),
        fetch('/api/crypto?type=halving'),
      ])

      if (coinsRes.status === 'fulfilled') {
        const j = await coinsRes.value.json()
        if (j.data) { setCoins(j.data); if (!selectedCoin) setSelectedCoin(j.data[0]) }
      }
      if (fgRes.status === 'fulfilled') {
        const j = await fgRes.value.json()
        if (j.data?.[0]) setFearGreed(j.data[0])
      }
      if (defiRes.status === 'fulfilled') {
        const j = await defiRes.value.json()
        if (j.data) setDefi(j.data.slice(0, 10))
      }
      if (trendRes.status === 'fulfilled') {
        const j = await trendRes.value.json()
        if (j.data) setTrending(j.data.slice(0, 7))
      }
      if (globalRes.status === 'fulfilled') {
        const j = await globalRes.value.json()
        if (j.data) setGlobalData(j.data)
      }
      if (halvingRes.status === 'fulfilled') {
        const j = await halvingRes.value.json()
        if (j.data) setHalving(j.data)
      }
      setLoading(false)
    }
    fetchAll()
    const id = setInterval(fetchAll, 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selectedCoin) return
    const fetchChart = async () => {
      const res = await fetch(`/api/crypto?type=chart&coin=${selectedCoin.id}&days=30`)
      const json = await res.json()
      if (json.data) {
        const candles = json.data.map((d: [number, number, number, number, number]) => ({
          time: Math.floor(d[0] / 1000),
          open: d[1],
          high: d[2],
          low: d[3],
          close: d[4],
        }))
        setChartData(candles)
      }
    }
    fetchChart()
  }, [selectedCoin?.id])

  const dominanceData = globalData?.market_cap_percentage
    ? [
        { name: 'BTC', value: globalData.market_cap_percentage.btc },
        { name: 'ETH', value: globalData.market_cap_percentage.eth },
        { name: 'Others', value: 100 - globalData.market_cap_percentage.btc - globalData.market_cap_percentage.eth },
      ]
    : []

  // Build AI context from top coins
  const aiData = coins.slice(0, 20).map(c => {
    const sym = c.symbol.toUpperCase() + 'USDT'
    const bt = binanceTickers.get(sym)
    return {
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: bt?.price ?? c.current_price,
      change24h: bt?.changePct ?? c.price_change_percentage_24h,
      marketCap: c.market_cap,
      rank: c.market_cap_rank,
    }
  })

  return (
    <div className="p-2 flex gap-2 h-full">
      {/* Left: Top 100 Table */}
      <div style={{ width: 520, flexShrink: 0 }} className="flex flex-col">
        <PanelWrapper
          title="CRYPTO TOP 100"
          loading={loading}
          fullHeight
          source={binanceTickers.size > 0 ? 'live' : undefined}
        >
          {/* Panel header with Binance status and AI button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid #0d1f0d' }}>
            {binanceTickers.size > 0 ? (
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-positive)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--text-positive)', animation: 'pulseLive 1.5s ease-in-out infinite' }} />
                BINANCE LIVE · {binanceTickers.size} PAIRS
              </span>
            ) : (
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--text-muted)' }}>
                CONNECTING TO BINANCE...
              </span>
            )}
            <AIButton panelData={aiData} panelName="CRYPTO" context="Focus on BTC dominance, altcoin rotation, and any unusual volume spikes." style={{ marginLeft: 'auto' }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 175px)' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th>#</th>
                  <th style={{ textAlign: 'left' }}>COIN</th>
                  <th>PRICE</th>
                  <th>24H%</th>
                  <th>7D%</th>
                  <th>MKT CAP</th>
                  <th>CHART</th>
                </tr>
              </thead>
              <tbody>
                {coins.map(coin => {
                  const sym = coin.symbol.toUpperCase() + 'USDT'
                  const bt = binanceTickers.get(sym)
                  return (
                    <CoinRow
                      key={coin.id}
                      coin={coin}
                      isSelected={selectedCoin?.id === coin.id}
                      onSelect={() => setSelectedCoin(coin)}
                      binancePrice={bt?.price}
                      binanceChangePct={bt?.changePct}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </PanelWrapper>
      </div>

      {/* Center: Chart + Details */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {selectedCoin && (
          <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
            <div className="panel-header">
              <span className="panel-header-title">{selectedCoin.name} ({selectedCoin.symbol.toUpperCase()}) — 30D OHLC</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={selectedCoin.price_change_percentage_24h >= 0 ? 'positive font-mono text-[11px]' : 'negative font-mono text-[11px]'}>
                  {formatCurrency(binanceTickers.get(selectedCoin.symbol.toUpperCase() + 'USDT')?.price ?? selectedCoin.current_price)}{' '}
                  {formatPercent(binanceTickers.get(selectedCoin.symbol.toUpperCase() + 'USDT')?.changePct ?? selectedCoin.price_change_percentage_24h)}
                </span>
                <AIButton
                  panelData={{ coin: selectedCoin.name, symbol: selectedCoin.symbol.toUpperCase(), price: selectedCoin.current_price, change24h: selectedCoin.price_change_percentage_24h, marketCap: selectedCoin.market_cap }}
                  panelName={`${selectedCoin.name} (${selectedCoin.symbol.toUpperCase()})`}
                />
              </div>
            </div>
            <CandlestickChart candles={chartData} height={250} showVolume />
          </div>
        )}

        {/* Global Market */}
        {globalData && (
          <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
            <div className="panel-header">
              <span className="panel-header-title">GLOBAL CRYPTO MARKET</span>
            </div>
            <div className="flex items-center gap-4 p-2">
              <div>
                <div className="font-mono text-[10px] text-muted">TOTAL MKT CAP</div>
                <div className="font-mono text-[14px] text-primary">{formatNumber(globalData.total_market_cap?.usd || 0)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted">BTC DOMINANCE</div>
                <div className="font-mono text-[14px] text-accent">{globalData.market_cap_percentage?.btc?.toFixed(1)}%</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-muted">ETH DOMINANCE</div>
                <div className="font-mono text-[14px] text-neutral">{globalData.market_cap_percentage?.eth?.toFixed(1)}%</div>
              </div>
              {dominanceData.length > 0 && (
                <ResponsiveContainer width={100} height={80}>
                  <PieChart>
                    <Pie data={dominanceData} cx={50} cy={40} innerRadius={25} outerRadius={40} dataKey="value" isAnimationActive={false}>
                      <Cell fill="#ff6d00" />
                      <Cell fill="#607d8b" />
                      <Cell fill="#1b2e1b" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: 'var(--bg-terminal)', border: '1px solid #1b2e1b', fontFamily: 'IBM Plex Mono', fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div style={{ width: 200, flexShrink: 0 }} className="space-y-2">
        {/* Fear & Greed */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <div className="panel-header">
            <span className="panel-header-title">FEAR & GREED</span>
          </div>
          {fearGreed && <FearGreedGauge value={parseInt(fearGreed.value)} />}
        </div>

        {/* BTC Halving */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <div className="panel-header">
            <span className="panel-header-title">NEXT BTC HALVING</span>
          </div>
          <div className="flex justify-around p-2">
            {[{ v: halving.days, l: 'DAYS' }, { v: halving.hours, l: 'HRS' }, { v: halving.minutes, l: 'MIN' }].map(item => (
              <div key={item.l} className="text-center">
                <div className="font-mono text-[18px] text-accent font-bold">{item.v}</div>
                <div className="font-mono text-[9px] text-muted">{item.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <div className="panel-header">
            <span className="panel-header-title">🔥 TRENDING</span>
          </div>
          {trending.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1" style={{ borderBottom: '1px solid #0d1f0d' }}>
              <span className="font-mono text-[9px] text-muted">{i + 1}</span>
              <span className="font-bold text-[10px] text-accent">{t.item.symbol}</span>
              <span className="text-muted text-[9px]">{t.item.name.slice(0, 12)}</span>
            </div>
          ))}
        </div>

        {/* DeFi TVL */}
        <div style={{ border: '1px solid #1b2e1b', background: 'var(--bg-terminal)' }}>
          <div className="panel-header">
            <span className="panel-header-title">DEFI TVL</span>
          </div>
          {defi.map(d => (
            <div key={d.name} className="flex items-center justify-between px-2 py-1" style={{ borderBottom: '1px solid #0d1f0d' }}>
              <span className="font-bold text-[10px] text-accent">{d.symbol}</span>
              <span className="font-mono text-[10px] text-primary">${formatNumber(d.tvl)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
