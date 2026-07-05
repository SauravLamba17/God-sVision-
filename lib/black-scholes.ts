function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

function normCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export interface Greeks {
  price:  number
  delta:  number
  gamma:  number
  theta:  number
  vega:   number
  rho:    number
  iv:     number
}

export function blackScholes(
  S: number,   // spot price
  K: number,   // strike price
  T: number,   // time to expiry in years
  r: number,   // risk-free rate (decimal)
  sigma: number, // implied volatility (decimal)
  type: 'call' | 'put' = 'call'
): Greeks {
  if (T <= 0 || sigma <= 0) {
    const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0)
    return { price: intrinsic, delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, iv: sigma }
  }

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT

  const gamma = normPDF(d1) / (S * sigma * sqrtT)

  if (type === 'call') {
    const Nd1 = normCDF(d1), Nd2 = normCDF(d2)
    const price = S * Nd1 - K * Math.exp(-r * T) * Nd2
    const delta = Nd1
    const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * Nd2) / 365
    const vega  = S * normPDF(d1) * sqrtT / 100
    const rho   = K * T * Math.exp(-r * T) * Nd2 / 100
    return { price, delta, gamma, theta, vega, rho, iv: sigma }
  } else {
    const Nd1 = normCDF(-d1), Nd2 = normCDF(-d2)
    const price = K * Math.exp(-r * T) * Nd2 - S * Nd1
    const delta = -Nd1
    const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * Nd2) / 365
    const vega  = S * normPDF(d1) * sqrtT / 100
    const rho   = -K * T * Math.exp(-r * T) * Nd2 / 100
    return { price, delta, gamma, theta, vega, rho, iv: sigma }
  }
}

export function impliedVolatility(
  marketPrice: number,
  S: number, K: number, T: number, r: number,
  type: 'call' | 'put' = 'call',
  maxIter = 100,
  tol = 1e-6
): number {
  if (T <= 0) return 0
  let sigma = 0.25
  for (let i = 0; i < maxIter; i++) {
    const { price, vega } = blackScholes(S, K, T, r, sigma, type)
    const diff = price - marketPrice
    if (Math.abs(diff) < tol) break
    if (Math.abs(vega) < 1e-10) break
    sigma = sigma - diff / (vega * 100) // vega was divided by 100 above
    if (sigma <= 0) sigma = 1e-4
    if (sigma > 10) sigma = 10
  }
  return sigma
}

export function daysToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  const now = new Date()
  return Math.max((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365), 0)
}
