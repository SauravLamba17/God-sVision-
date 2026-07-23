'use client';
import { useId, useMemo } from 'react';

interface SparklineProps {
  data: number[] | null;
  isPositive: boolean;
  width?: number;
  height?: number;
  loading?: boolean;
}

export function Sparkline({ data, isPositive, width = 70, height = 32, loading }: SparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 3; // padding inside svg to avoid clipping stroke

    const points = data.map((p, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = padding + ((max - p) / range) * (height - padding * 2);
      return { x, y };
    });

    // Build smooth curve using quadratic bezier between midpoints
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      d += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
    }
    d += ` T ${points[points.length - 1].x},${points[points.length - 1].y}`;

    // Fill path — closes down to bottom of svg
    const fillD = `${d} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

    return { linePath: d, fillPath: fillD, lastPoint: points[points.length - 1] };
  }, [data, width, height]);

  const color = isPositive ? '#00e676' : '#ff1744';
  const gradientId = useId();

  // Loading skeleton — subtle pulsing bar, doesn't break layout
  if (loading) {
    return (
      <div style={{
        width, height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: width * 0.7,
          height: 2,
          background: 'var(--border-color)',
          borderRadius: '1px',
          animation: 'sparkPulse 1.4s ease-in-out infinite',
        }} />
      </div>
    );
  }

  // Graceful fallback — flat line if data genuinely unavailable
  // (never breaks the card layout, never shows an error to the user)
  if (!pathData) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line
          x1="3" y1={height / 2} x2={width - 3} y2={height / 2}
          stroke={color} strokeWidth="1.5" strokeOpacity="0.35"
          strokeDasharray="2,2"
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill under the line */}
      <path d={pathData.fillPath} fill={`url(#${gradientId})`} />

      {/* The line itself */}
      <path
        d={pathData.linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pulsing dot at the current price point */}
      <circle
        cx={pathData.lastPoint.x}
        cy={pathData.lastPoint.y}
        r="2.5"
        fill={color}
      >
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx={pathData.lastPoint.x}
        cy={pathData.lastPoint.y}
        r="4.5"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.4"
      />
    </svg>
  );
}
