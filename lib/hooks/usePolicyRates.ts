'use client'
import { useEffect, useState } from 'react'
import type { PolicyRate } from '@/lib/apis/fred'

// Live central-bank policy rates (FRED). `error` is set when none are available,
// so callers render an honest unavailable state instead of numbers.
export function usePolicyRates() {
  const [rates, setRates] = useState<PolicyRate[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/forex?type=central_banks')
      .then(r => r.json())
      .then(j => (j.data ? setRates(j.data) : setError(j.error ?? 'Policy rates unavailable')))
      .catch(() => setError('Policy rates unavailable'))
  }, [])
  return { rates, error }
}
