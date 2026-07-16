'use client'
import { useEffect, useRef, useCallback } from 'react'
import {
  createChart, ColorType, CrosshairMode,
  IChartApi, ISeriesApi, Time,
} from 'lightweight-charts'

export interface OHLCCandle {
  time: string | number
  open: number; high: number; low: number; close: number; volume?: number
}

export interface IndicatorPoint { time: string | number; value: number | null }

interface Props {
  candles:    OHLCCandle[]
  height?:    number
  showVolume?: boolean
  showRsi?:   boolean
  showMacd?:  boolean
  rsiData?:   IndicatorPoint[]
  macdData?:  { time: string | number; macd: number | null; signal: number | null; hist: number | null }[]
  overlays?: {
    sma20?:   IndicatorPoint[]; sma50?: IndicatorPoint[]; sma200?: IndicatorPoint[]
    ema12?:   IndicatorPoint[]; ema26?: IndicatorPoint[]
    bbUpper?: IndicatorPoint[]; bbLower?: IndicatorPoint[]
  }
}

// Hardcoded hex — lightweight-charts cannot parse CSS variables
const BG          = '#050a05'
const GRID        = '#1b2e1b'
const TEXT        = '#607d8b'
const UP_COLOR    = '#00e676'
const DOWN_COLOR  = '#ff1744'
const BORDER_UP   = '#00e676'
const BORDER_DOWN = '#ff1744'
const WICK_UP     = '#00e676'
const WICK_DOWN   = '#ff1744'
const SMA20_COLOR = '#40c4ff'
const SMA50_COLOR = '#ff6d00'
const CROSSHAIR   = '#607d8b'

function filterNull(data: IndicatorPoint[]): { time: Time; value: number }[] {
  return data.filter(d => d.value !== null).map(d => ({ time: d.time as Time, value: d.value as number }))
}

export default function CandlestickChartInner({
  candles, height = 420, showVolume = true, showRsi = false, showMacd = false,
  rsiData = [], macdData = [], overlays = {},
}: Props) {
  const mainRef  = useRef<HTMLDivElement>(null)
  const rsiRef   = useRef<HTMLDivElement>(null)
  const macdRef  = useRef<HTMLDivElement>(null)
  const mainChart = useRef<IChartApi | null>(null)
  const rsiChart  = useRef<IChartApi | null>(null)
  const macdChart = useRef<IChartApi | null>(null)

  const makeChart = useCallback((el: HTMLDivElement, h: number) =>
    createChart(el, {
      width: el.offsetWidth,
      height: h,
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: TEXT,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CROSSHAIR, labelBackgroundColor: '#0a140a' },
        horzLine: { color: CROSSHAIR, labelBackgroundColor: '#0a140a' },
      },
      rightPriceScale: {
        borderColor: GRID,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
      },
    }), [])

  useEffect(() => {
    if (!mainRef.current || !candles?.length) return

    const subH  = showRsi || showMacd ? 110 : 0
    const count = (showRsi ? 1 : 0) + (showMacd ? 1 : 0)
    const mainH = height - count * subH

    // ── Main chart ───────────────────────────────────────────────────
    const chart = makeChart(mainRef.current, mainH)
    mainChart.current = chart

    const candleSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor:        UP_COLOR,
      downColor:      DOWN_COLOR,
      borderUpColor:  BORDER_UP,
      borderDownColor: BORDER_DOWN,
      wickUpColor:    WICK_UP,
      wickDownColor:  WICK_DOWN,
    })
    candleSeries.setData(
      candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    )

    // Volume histogram (attached to main chart, separate scale)
    if (showVolume && candles.some(c => c.volume)) {
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        color: '#38bdf820',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      volSeries.setData(
        candles.filter(c => c.volume).map(c => ({
          time: c.time as Time, value: c.volume!,
          color: c.close >= c.open ? '#22c55e30' : '#ef444430',
        }))
      )
    }

    // Overlay lines
    const lineOpts = (color: string, w = 1) => ({ color, lineWidth: w as 1|2|3|4, lastValueVisible: false, priceLineVisible: false })
    if (overlays.sma20?.length)   { const s = chart.addLineSeries(lineOpts(SMA20_COLOR)); s.setData(filterNull(overlays.sma20)) }
    if (overlays.sma50?.length)   { const s = chart.addLineSeries(lineOpts(SMA50_COLOR)); s.setData(filterNull(overlays.sma50)) }
    if (overlays.sma200?.length)  { const s = chart.addLineSeries(lineOpts('#a78bfa')); s.setData(filterNull(overlays.sma200)) }
    if (overlays.ema12?.length)   { const s = chart.addLineSeries(lineOpts('#34d399')); s.setData(filterNull(overlays.ema12)) }
    if (overlays.ema26?.length)   { const s = chart.addLineSeries(lineOpts('#fb923c')); s.setData(filterNull(overlays.ema26)) }
    if (overlays.bbUpper?.length && overlays.bbLower?.length) {
      const opt = { color: '#22c55e40', lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false }
      const u = chart.addLineSeries(opt); u.setData(filterNull(overlays.bbUpper))
      const l = chart.addLineSeries(opt); l.setData(filterNull(overlays.bbLower))
    }

    // ── RSI sub-chart ─────────────────────────────────────────────────
    if (showRsi && rsiRef.current && rsiData.length) {
      const rc = makeChart(rsiRef.current, subH)
      rsiChart.current = rc
      rc.timeScale().applyOptions({ visible: false })
      const rsiSeries = rc.addLineSeries({ color: SMA20_COLOR, lineWidth: 1 as 1, lastValueVisible: true, priceLineVisible: false })
      rsiSeries.setData(filterNull(rsiData))
      rc.addLineSeries({ color: '#ef444460', lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false })
        .setData(rsiData.filter(d => d.value !== null).map(d => ({ time: d.time as Time, value: 70 })))
      rc.addLineSeries({ color: '#22c55e60', lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false })
        .setData(rsiData.filter(d => d.value !== null).map(d => ({ time: d.time as Time, value: 30 })))

      // Sync time ranges
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) rc.timeScale().setVisibleLogicalRange(range)
      })
      rc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) chart.timeScale().setVisibleLogicalRange(range)
      })
    }

    // ── MACD sub-chart ────────────────────────────────────────────────
    if (showMacd && macdRef.current && macdData.length) {
      const mc = makeChart(macdRef.current, subH)
      macdChart.current = mc
      mc.timeScale().applyOptions({ visible: true })

      const histSeries = mc.addHistogramSeries({
        color: '#22c55e60', lastValueVisible: false, priceLineVisible: false,
      })
      histSeries.setData(
        macdData.filter(d => d.hist !== null).map(d => ({
          time: d.time as Time, value: d.hist!,
          color: d.hist! >= 0 ? '#22c55e80' : '#ef444480',
        }))
      )
      const macdLine   = mc.addLineSeries({ color: SMA20_COLOR, lineWidth: 1 as 1, lastValueVisible: true,  priceLineVisible: false })
      const signalLine = mc.addLineSeries({ color: SMA50_COLOR, lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false })
      macdLine.setData(macdData.filter(d => d.macd   !== null).map(d => ({ time: d.time as Time, value: d.macd! })))
      signalLine.setData(macdData.filter(d => d.signal !== null).map(d => ({ time: d.time as Time, value: d.signal! })))

      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) mc.timeScale().setVisibleLogicalRange(range)
      })
      mc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) chart.timeScale().setVisibleLogicalRange(range)
      })
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current) chart.resize(mainRef.current.offsetWidth, mainH)
      if (rsiRef.current  && rsiChart.current)  rsiChart.current.resize(rsiRef.current.offsetWidth, subH)
      if (macdRef.current && macdChart.current) macdChart.current.resize(macdRef.current.offsetWidth, subH)
    })
    if (mainRef.current) ro.observe(mainRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      rsiChart.current?.remove()
      macdChart.current?.remove()
      rsiChart.current  = null
      macdChart.current = null
      mainChart.current = null
    }
  }, [candles, showVolume, showRsi, showMacd, rsiData, macdData, overlays, height, makeChart])

  return (
    <div style={{ width: '100%' }}>
      <div ref={mainRef}  style={{ width: '100%' }} />
      {showRsi  && <div ref={rsiRef}  style={{ width: '100%', borderTop: `1px solid ${GRID}` }} />}
      {showMacd && <div ref={macdRef} style={{ width: '100%', borderTop: `1px solid ${GRID}` }} />}
    </div>
  )
}
