// Background price alert checker — runs in browser, polls prices against user-defined thresholds

export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below'
export type AlertStatus = 'active' | 'triggered' | 'dismissed'

export interface PriceAlert {
  id: string
  ticker: string
  condition: AlertCondition
  targetPrice: number
  currentPrice?: number
  createdAt: number
  triggeredAt?: number
  status: AlertStatus
  note?: string
}

const STORAGE_KEY = 'gv_price_alerts'
const LAST_PRICES_KEY = 'gv_alert_last_prices'

// ─── Persistence ─────────────────────────────────────────────────────────────

export function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)) } catch { /* ignore */ }
}

export function addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>): PriceAlert {
  const newAlert: PriceAlert = {
    ...alert,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    status: 'active',
  }
  const alerts = loadAlerts()
  alerts.push(newAlert)
  saveAlerts(alerts)
  return newAlert
}

export function removeAlert(id: string): void {
  const alerts = loadAlerts().filter(a => a.id !== id)
  saveAlerts(alerts)
}

export function dismissAlert(id: string): void {
  const alerts = loadAlerts().map(a => a.id === id ? { ...a, status: 'dismissed' as AlertStatus } : a)
  saveAlerts(alerts)
}

// ─── Last-price cache (for cross detection) ──────────────────────────────────

function loadLastPrices(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LAST_PRICES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveLastPrices(prices: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(prices)) } catch { /* ignore */ }
}

// ─── Core check logic ─────────────────────────────────────────────────────────

function isTriggered(alert: PriceAlert, currentPrice: number, lastPrice: number | undefined): boolean {
  switch (alert.condition) {
    case 'above':
      return currentPrice >= alert.targetPrice
    case 'below':
      return currentPrice <= alert.targetPrice
    case 'crosses_above':
      return lastPrice !== undefined
        ? lastPrice < alert.targetPrice && currentPrice >= alert.targetPrice
        : currentPrice >= alert.targetPrice
    case 'crosses_below':
      return lastPrice !== undefined
        ? lastPrice > alert.targetPrice && currentPrice <= alert.targetPrice
        : currentPrice <= alert.targetPrice
    default:
      return false
  }
}

export interface AlertCheckResult {
  triggeredAlerts: PriceAlert[]
  updatedAlerts: PriceAlert[]
}

/**
 * Check all active alerts against a price map.
 * @param priceMap  ticker → current price (e.g. { 'AAPL': 182.5, '^VIX': 14.2 })
 * @returns newly triggered alerts and the full updated alert list
 */
export function checkAlerts(priceMap: Record<string, number>): AlertCheckResult {
  const alerts = loadAlerts()
  const lastPrices = loadLastPrices()
  const triggered: PriceAlert[] = []

  const updated = alerts.map(alert => {
    if (alert.status !== 'active') return alert
    const currentPrice = priceMap[alert.ticker.toUpperCase()]
    if (currentPrice === undefined) return alert

    const lastPrice = lastPrices[alert.ticker.toUpperCase()]
    const shouldTrigger = isTriggered(alert, currentPrice, lastPrice)

    if (shouldTrigger) {
      const updatedAlert: PriceAlert = {
        ...alert,
        currentPrice,
        status: 'triggered',
        triggeredAt: Date.now(),
      }
      triggered.push(updatedAlert)
      return updatedAlert
    }

    return { ...alert, currentPrice }
  })

  // Update last prices for cross detection
  const newLastPrices = { ...lastPrices, ...priceMap }
  saveLastPrices(newLastPrices)
  saveAlerts(updated)

  return { triggeredAlerts: triggered, updatedAlerts: updated }
}

// ─── Browser notification ─────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function fireNotification(alert: PriceAlert): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  const condLabel: Record<AlertCondition, string> = {
    above: 'above',
    below: 'below',
    crosses_above: 'crossed above',
    crosses_below: 'crossed below',
  }

  new Notification(`🔔 ${alert.ticker} Alert`, {
    body: `${alert.ticker} is ${condLabel[alert.condition]} ₹${alert.targetPrice.toLocaleString()}` +
      (alert.currentPrice !== undefined ? ` (now: ₹${alert.currentPrice.toLocaleString()})` : '') +
      (alert.note ? `\n${alert.note}` : ''),
    icon: '/favicon.ico',
    tag: alert.id,
  })
}

// ─── Auto-check loop (call once from a client component) ─────────────────────

let checkerInterval: ReturnType<typeof setInterval> | null = null

export function startAlertChecker(
  onTriggered: (alerts: PriceAlert[]) => void,
  intervalMs = 30000
): () => void {
  if (typeof window === 'undefined') return () => {}

  const run = async () => {
    const active = loadAlerts().filter(a => a.status === 'active')
    if (active.length === 0) return

    const tickers = [...new Set(active.map(a => a.ticker.toUpperCase()))].join(',')
    try {
      const res = await fetch(`/api/stocks?tickers=${tickers}`)
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data?.data)) return

      const priceMap: Record<string, number> = {}
      for (const q of data.data) {
        if (q.symbol && q.regularMarketPrice != null) {
          priceMap[q.symbol.toUpperCase()] = q.regularMarketPrice
        }
      }

      const { triggeredAlerts } = checkAlerts(priceMap)
      if (triggeredAlerts.length > 0) {
        triggeredAlerts.forEach(fireNotification)
        onTriggered(triggeredAlerts)
      }
    } catch { /* network error — silently skip */ }
  }

  // Run immediately then on interval
  run()
  checkerInterval = setInterval(run, intervalMs)

  return () => {
    if (checkerInterval) { clearInterval(checkerInterval); checkerInterval = null }
  }
}

export function stopAlertChecker(): void {
  if (checkerInterval) { clearInterval(checkerInterval); checkerInterval = null }
}
