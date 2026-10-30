'use client'
import { useTheme } from '@/lib/context/ThemeContext'
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface DataPoint {
  date: string
  value: number
  [key: string]: string | number
}

interface LineChartProps {
  data: DataPoint[]
  dataKey?: string
  color?: string
  height?: number
  showGrid?: boolean
  formatValue?: (v: number) => string
  label?: string
}

const CustomTooltip = ({ active, payload, label, formatValue }: {
  active?: boolean
  payload?: unknown[]
  label?: string
  formatValue?: (v: number) => string
}) => {
  if (!active || !payload?.length) return null
  const val = (payload[0] as { value?: number })?.value
  return (
    <div style={{ background: 'var(--surface-2)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius-inner)', padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>
      <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-meta)' }}>{label}</p>
      <p style={{ color: 'var(--accent-text)', fontSize: 'var(--fs-body)' }}>{formatValue && val !== undefined ? formatValue(Number(val)) : typeof val === 'number' ? val.toFixed(2) : val}</p>
    </div>
  )
}

// Colours are token vars (recharts passes them to SVG), so a theme switch re-colours instantly.
const TICK = { fill: 'var(--muted)', fontSize: 'var(--fs-badge)', fontFamily: 'var(--font-mono)' }

export default function LineChartComponent({
  data,
  dataKey = 'value',
  color = 'var(--up)',
  height = 200,
  showGrid = true,
  formatValue,
  label
}: LineChartProps) {
  const { contrast } = useTheme()
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-muted font-mono text-[11px]">NO DATA</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* right: 20 so the last x-axis label (e.g. "23:00" in the mono font) isn't clipped */}
      <ReLineChart data={data} margin={{ top: 4, right: 20, bottom: 4, left: 40 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="2 4" stroke="var(--divider)" vertical={false} />
        )}
        <XAxis
          dataKey="date"
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
          width={38}
        />
        <Tooltip content={(props) => <CustomTooltip active={props.active} payload={props.payload as unknown[] | undefined} label={props.label} formatValue={formatValue} />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={contrast === 'high' ? 3 : 1.5}
          dot={false}
          isAnimationActive={false}
        />
      </ReLineChart>
    </ResponsiveContainer>
  )
}
