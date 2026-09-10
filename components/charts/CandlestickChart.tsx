import dynamic from 'next/dynamic'
export type { OHLCCandle, IndicatorPoint } from './CandlestickChartInner'

export default dynamic(() => import('./CandlestickChartInner'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-terminal)', border: '1px solid #1e293b',
    }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 'var(--fs-body)', color: 'var(--text-accent)' }}>
        LOADING CHART<span className="blink-cursor" />
      </span>
    </div>
  ),
})
