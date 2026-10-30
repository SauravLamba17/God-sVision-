import dynamic from 'next/dynamic'
export type { OHLCCandle, IndicatorPoint } from './CandlestickChartInner'

export default dynamic(() => import('./CandlestickChartInner'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface)',
    }}>
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
        LOADING CHART<span className="blink-cursor" />
      </span>
    </div>
  ),
})
