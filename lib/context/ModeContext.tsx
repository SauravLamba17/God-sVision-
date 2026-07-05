'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type TerminalMode = 'USA' | 'INDIA'

interface ModeContextType {
  mode: TerminalMode
  toggleMode: () => void
  isIndia: boolean
  isUSA: boolean
  currency: string
  currencySymbol: string
  timezone: string
  timezoneLabel: string
  locale: string
  exchangeRate: number
  formatCurrency: (usdAmount: number) => string
  formatTime: (date: Date | string) => string
  formatDate: (date: Date | string) => string
}

const ModeContext = createContext<ModeContextType | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TerminalMode>('USA')
  const [exchangeRate, setExchangeRate] = useState<number>(83.5)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gv_terminal_mode') as TerminalMode
      if (saved === 'USA' || saved === 'INDIA') setMode(saved)
    } catch { /* ignore */ }
  }, [])

  // Set data-terminal-mode on <html> for CSS targeting
  useEffect(() => {
    document.documentElement.setAttribute('data-terminal-mode', mode)
  }, [mode])

  useEffect(() => {
    const fetchRate = () => {
      fetch('https://api.exchangerate-api.com/v4/latest/USD')
        .then(r => r.json())
        .then(d => { if (d.rates?.INR) setExchangeRate(d.rates.INR) })
        .catch(() => {})
    }
    fetchRate()
    const id = setInterval(fetchRate, 600000)
    return () => clearInterval(id)
  }, [])

  const toggleMode = () => {
    const next = mode === 'USA' ? 'INDIA' : 'USA'
    setMode(next)
    try { localStorage.setItem('gv_terminal_mode', next) } catch { /* ignore */ }
  }

  const isIndia = mode === 'INDIA'
  const isUSA   = mode === 'USA'

  const currency      = isIndia ? 'INR' : 'USD'
  const currencySymbol = isIndia ? '₹'  : '$'
  const timezone      = isIndia ? 'Asia/Kolkata'      : 'America/New_York'
  const timezoneLabel = isIndia ? 'IST'               : 'ET'
  const locale        = isIndia ? 'en-IN'             : 'en-US'

  const formatCurrency = (usdAmount: number): string => {
    if (isIndia) {
      const inr = usdAmount * exchangeRate
      if (inr >= 10_000_000) return '₹' + (inr / 10_000_000).toFixed(2) + ' Cr'
      if (inr >= 100_000)    return '₹' + (inr / 100_000).toFixed(2) + ' L'
      return '₹' + inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    }
    if (usdAmount >= 1e12) return '$' + (usdAmount / 1e12).toFixed(2) + 'T'
    if (usdAmount >= 1e9)  return '$' + (usdAmount / 1e9).toFixed(2) + 'B'
    if (usdAmount >= 1e6)  return '$' + (usdAmount / 1e6).toFixed(2) + 'M'
    return '$' + usdAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }

  const formatTime = (date: Date | string): string =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(date))

  const formatDate = (date: Date | string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(date))

  return (
    <ModeContext.Provider value={{
      mode, toggleMode, isIndia, isUSA,
      currency, currencySymbol, timezone, timezoneLabel, locale, exchangeRate,
      formatCurrency, formatTime, formatDate,
    }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode must be used within ModeProvider')
  return ctx
}
