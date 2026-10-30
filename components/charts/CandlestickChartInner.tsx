'use client'
import { useEffect, useRef } from 'react'
import { useTheme, readToken } from '@/lib/context/ThemeContext'
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

function filterNull(data: IndicatorPoint[]): { time: Time; value: number }[] {
  return data.filter(d => d.value !== null).map(d => ({ time: d.time as Time, value: d.value as number }))
}

/** '#RRGGBB' + alpha → '#RRGGBBAA' (lightweight-charts can't read CSS variables, so tokens are read as hex). */
const alpha = (hex: string, a: number) => hex.length === 7 ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex

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
  // The chart is rebuilt from the current tokens whenever either setting changes.
  const { theme, contrast } = useTheme()

  useEffect(() => {
    if (!mainRef.current || !candles?.length) return

    const tok = (name: string, fallback: string) => readToken(name) || fallback
    const BG = tok('--surface', '#1B1B1B'), GRID = tok('--divider', '#242424'), TEXT = tok('--muted', '#B5B5B5')
    const UP_COLOR = tok('--up', '#2EBD85'), DOWN_COLOR = tok('--down', '#F6685E')
    const SMA20_COLOR = tok('--info', '#6CB6FF'), SMA50_COLOR = tok('--accent-text', '#FF9933')
    const LABEL_BG = tok('--surface-2', '#222222'), W = (contrast === 'high' ? 3 : 1) as 1 | 3
    const makeChart = (el: HTMLDivElement, h: number) =>
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
          vertLine: { color: TEXT, labelBackgroundColor: LABEL_BG },
          horzLine: { color: TEXT, labelBackgroundColor: LABEL_BG },
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
      })

    const subH  = showRsi || showMacd ? 110 : 0
    const count = (showRsi ? 1 : 0) + (showMacd ? 1 : 0)
    const mainH = height - count * subH

    // ── Main chart ───────────────────────────────────────────────────
    const chart = makeChart(mainRef.current, mainH)
    mainChart.current = chart

    const candleSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor:        UP_COLOR,
      downColor:      DOWN_COLOR,
      borderUpColor:  UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor:    UP_COLOR,
      wickDownColor:  DOWN_COLOR,
    })
    candleSeries.setData(
      candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    )

    // Volume histogram (attached to main chart, separate scale)
    if (showVolume && candles.some(c => c.volume)) {
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        color: alpha(SMA20_COLOR, 0.12),
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      volSeries.setData(
        candles.filter(c => c.volume).map(c => ({
          time: c.time as Time, value: c.volume!,
          color: alpha(c.close >= c.open ? UP_COLOR : DOWN_COLOR, 0.2),
        }))
      )
    }

    // Overlay lines
    const lineOpts = (color: string) => ({ color, lineWidth: W, lastValueVisible: false, priceLineVisible: false })
    if (overlays.sma20?.length)   { const s = chart.addLineSeries(lineOpts(SMA20_COLOR)); s.setData(filterNull(overlays.sma20)) }
    if (overlays.sma50?.length)   { const s = chart.addLineSeries(lineOpts(SMA50_COLOR)); s.setData(filterNull(overlays.sma50)) }
    if (overlays.sma200?.length)  { const s = chart.addLineSeries(lineOpts(tok('--text-2', '#CFCFCF'))); s.setData(filterNull(overlays.sma200)) }
    if (overlays.ema12?.length)   { const s = chart.addLineSeries(lineOpts(tok('--warning', '#F5B841'))); s.setData(filterNull(overlays.ema12)) }
    if (overlays.ema26?.length)   { const s = chart.addLineSeries(lineOpts(TEXT)); s.setData(filterNull(overlays.ema26)) }
    if (overlays.bbUpper?.length && overlays.bbLower?.length) {
      const opt = { color: alpha(UP_COLOR, 0.4), lineWidth: W, lastValueVisible: false, priceLineVisible: false }
      const u = chart.addLineSeries(opt); u.setData(filterNull(overlays.bbUpper))
      const l = chart.addLineSeries(opt); l.setData(filterNull(overlays.bbLower))
    }

    // ── RSI sub-chart ─────────────────────────────────────────────────
    if (showRsi && rsiRef.current && rsiData.length) {
      const rc = makeChart(rsiRef.current, subH)
      rsiChart.current = rc
      rc.timeScale().applyOptions({ visible: false })
      const rsiSeries = rc.addLineSeries({ color: SMA20_COLOR, lineWidth: W, lastValueVisible: true, priceLineVisible: false })
      rsiSeries.setData(filterNull(rsiData))
      rc.addLineSeries({ color: alpha(DOWN_COLOR, 0.4), lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false })
        .setData(rsiData.filter(d => d.value !== null).map(d => ({ time: d.time as Time, value: 70 })))
      rc.addLineSeries({ color: alpha(UP_COLOR, 0.4), lineWidth: 1 as 1, lastValueVisible: false, priceLineVisible: false })
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
        color: alpha(UP_COLOR, 0.4), lastValueVisible: false, priceLineVisible: false,
      })
      histSeries.setData(
        macdData.filter(d => d.hist !== null).map(d => ({
          time: d.time as Time, value: d.hist!,
          color: alpha(d.hist! >= 0 ? UP_COLOR : DOWN_COLOR, 0.5),
        }))
      )
      const macdLine   = mc.addLineSeries({ color: SMA20_COLOR, lineWidth: W, lastValueVisible: true,  priceLineVisible: false })
      const signalLine = mc.addLineSeries({ color: SMA50_COLOR, lineWidth: W, lastValueVisible: false, priceLineVisible: false })
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
  }, [candles, showVolume, showRsi, showMacd, rsiData, macdData, overlays, height, theme, contrast])

  return (
    <div style={{ width: '100%' }}>
      <div ref={mainRef}  style={{ width: '100%' }} />
      {showRsi  && <div ref={rsiRef}  style={{ width: '100%', borderTop: '1px solid var(--divider)' }} />}
      {showMacd && <div ref={macdRef} style={{ width: '100%', borderTop: '1px solid var(--divider)' }} />}
    </div>
  )
}
