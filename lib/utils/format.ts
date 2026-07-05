export const fmtPrice = (n: number, decimals = 2): string => {
  if (!isFinite(n) || n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export const fmtINR = (n: number): string => {
  if (!isFinite(n) || n == null) return '—'
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export const fmtPct = (n: number, showSign = true): string => {
  if (!isFinite(n) || n == null) return '—'
  return `${showSign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export const fmtVol = (n: number): string => {
  if (!isFinite(n) || n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return `${n}`
}

export const fmtNum = (n: number, decimals = 2): string => {
  if (!isFinite(n) || n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export const fmtChange = (n: number, decimals = 2): string => {
  if (!isFinite(n) || n == null) return '—'
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(decimals)}`
}

export const arrow = (n: number): '▲' | '▼' | '→' =>
  n > 0 ? '▲' : n < 0 ? '▼' : '→'

export const changeColor = (n: number): string =>
  n > 0 ? 'var(--text-positive)' : n < 0 ? 'var(--text-negative)' : 'var(--text-muted)'
