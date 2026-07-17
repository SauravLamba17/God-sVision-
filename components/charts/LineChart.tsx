'use client'
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
    <div style={{ background: 'var(--bg-terminal)', border: '1px solid #1b2e1b', padding: '6px 10px', fontFamily: 'IBM Plex Mono' }}>
      <p style={{ color: '#546e7a', fontSize: 10 }}>{label}</p>
      <p style={{ color: 'var(--text-accent)', fontSize: 11 }}>{formatValue && val !== undefined ? formatValue(Number(val)) : typeof val === 'number' ? val.toFixed(2) : val}</p>
    </div>
  )
}

export default function LineChartComponent({
  data,
  dataKey = 'value',
  color = 'var(--text-positive)',
  height = 200,
  showGrid = true,
  formatValue,
  label
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-muted font-mono text-[11px]">NO DATA</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 40 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="2 4" stroke="#0d1f0d" vertical={false} />
        )}
        <XAxis
          dataKey="date"
          tick={{ fill: '#546e7a', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-color)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#546e7a', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
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
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </ReLineChart>
    </ResponsiveContainer>
  )
}
