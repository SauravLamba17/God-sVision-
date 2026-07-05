import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, decimals = 2, prefix = '$'): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  if (Math.abs(value) >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`
  return `${prefix}${value.toFixed(decimals)}`
}

export function formatNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(decimals)
}

export function formatPercent(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatTimestamp(date: Date | string | number): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isMarketOpen(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const timeInMinutes = hours * 60 + minutes
  if (day === 0 || day === 6) return false
  return timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60
}

export function isPreMarket(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const timeInMinutes = hours * 60 + minutes
  if (day === 0 || day === 6) return false
  return timeInMinutes >= 4 * 60 && timeInMinutes < 9 * 60 + 30
}

export function getMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE-MARKET' | 'AFTER-HOURS' {
  if (isMarketOpen()) return 'OPEN'
  if (isPreMarket()) return 'PRE-MARKET'
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const timeInMinutes = hours * 60 + minutes
  if (day !== 0 && day !== 6 && timeInMinutes >= 16 * 60 && timeInMinutes < 20 * 60) return 'AFTER-HOURS'
  return 'CLOSED'
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

export function timeAgo(date: Date | string | number): string {
  const now = new Date()
  const d = new Date(date)
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function magnitudeColor(mag: number): string {
  if (mag >= 7) return '#ff1744'
  if (mag >= 5) return '#ff6d00'
  if (mag >= 3) return '#ffd600'
  return '#546e7a'
}

export function altitudeColor(altitude: number): string {
  if (altitude > 30000) return '#2196f3'
  if (altitude > 15000) return '#00e676'
  return '#ffd600'
}

export function simpleSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase()
  const pos = ['surge', 'gain', 'rise', 'rally', 'soar', 'jump', 'record', 'high', 'growth', 'profit', 'beat', 'exceed', 'strong', 'bullish', 'boom']
  const neg = ['fall', 'drop', 'crash', 'plunge', 'decline', 'loss', 'risk', 'warn', 'miss', 'weak', 'bearish', 'recession', 'inflation', 'default', 'bankrupt']
  const posScore = pos.filter(w => lower.includes(w)).length
  const negScore = neg.filter(w => lower.includes(w)).length
  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}
