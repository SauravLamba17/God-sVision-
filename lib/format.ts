// Signed number / percent formatting for display. A value that rounds to zero
// at the shown precision is plain "0.0" — never "+0.0" or "−0.0" (JS's own
// (-0.004).toFixed(2) is "-0.00"). Pure; usable from client and server.

/** Signed number string: "+1.23", "-0.45" (or "−0.45" with minus '−'), "0.00". */
export function signed(value: number, digits = 2, minus: '-' | '−' = '-'): string {
  const abs = Math.abs(value).toFixed(digits)
  if (Number(abs) === 0) return (0).toFixed(digits)
  return `${value < 0 ? minus : '+'}${abs}`
}

/** Signed percent: "+1.2%", "-0.4%", "0.0%". */
export const pct = (value: number, digits = 1, minus: '-' | '−' = '-'): string => `${signed(value, digits, minus)}%`

/** Direction arrow for a move, '' when it rounds to zero at `digits`. */
export function arrow(value: number, digits = 2): '▲' | '▼' | '' {
  if (Number(Math.abs(value).toFixed(digits)) === 0) return ''
  return value > 0 ? '▲' : '▼'
}
