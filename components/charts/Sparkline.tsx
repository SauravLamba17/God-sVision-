'use client'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface SparklineProps {
  data: number[]
  positive?: boolean
  width?: number
  height?: number
}

export default function Sparkline({ data, positive, width = 80, height = 32 }: SparklineProps) {
  if (!data || data.length === 0) return <span className="text-muted text-[9px]">—</span>

  const isPositive = positive !== undefined ? positive : (data[data.length - 1] >= data[0])
  const color = isPositive ? 'var(--text-positive)' : 'var(--text-negative)'

  const chartData = data.map((v, i) => ({ v, i }))

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
