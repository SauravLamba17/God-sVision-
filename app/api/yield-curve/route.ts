import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getCache, setCache } from '@/lib/cache'

const MATURITIES = [
  { label: '1M',  id: 'DGS1MO',  months: 1   },
  { label: '3M',  id: 'DGS3MO',  months: 3   },
  { label: '6M',  id: 'DGS6MO',  months: 6   },
  { label: '1Y',  id: 'DGS1',    months: 12  },
  { label: '2Y',  id: 'DGS2',    months: 24  },
  { label: '3Y',  id: 'DGS3',    months: 36  },
  { label: '5Y',  id: 'DGS5',    months: 60  },
  { label: '7Y',  id: 'DGS7',    months: 84  },
  { label: '10Y', id: 'DGS10',   months: 120 },
  { label: '20Y', id: 'DGS20',   months: 240 },
  { label: '30Y', id: 'DGS30',   months: 360 },
]

async function fetchFredSeries(seriesId: string, limit = 365): Promise<{ date: string; value: number | null }[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`
  const res = await axios.get(url, { timeout: 8000, responseType: 'text' })
  const lines = (res.data as string).split('\n').slice(1)
  return lines
    .filter(l => l.trim())
    .slice(-limit)
    .map(line => {
      const [date, val] = line.split(',')
      const value = val?.trim() === '.' || !val?.trim() ? null : parseFloat(val.trim())
      return { date: date.trim(), value }
    })
    .filter(d => d.date)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'current'

  const cacheKey = `yield-curve:${mode}`
  const cached = await getCache(cacheKey)
  if (cached) return NextResponse.json({ data: cached, source: 'cache' })

  try {
    if (mode === 'current') {
      // Fetch current yield for each maturity
      const results = await Promise.allSettled(
        MATURITIES.map(m => fetchFredSeries(m.id, 10))
      )
      const curve = MATURITIES.map((m, i) => {
        const res = results[i]
        if (res.status === 'rejected') return { ...m, value: null }
        const data = res.value
        const latest = data.filter(d => d.value !== null).pop()
        const prev = data.filter(d => d.value !== null).slice(-2)[0]
        return {
          ...m,
          value:  latest?.value ?? null,
          prev:   prev?.value ?? null,
          change: latest && prev && latest.value !== null && prev.value !== null
            ? latest.value - prev.value : null,
        }
      })

      // Key spreads
      const get = (label: string) => curve.find(c => c.label === label)?.value ?? null
      const spreads = {
        '10Y-2Y':   get('10Y') !== null && get('2Y')  !== null ? +(get('10Y')! - get('2Y')!).toFixed(3)  : null,
        '10Y-3M':   get('10Y') !== null && get('3M')  !== null ? +(get('10Y')! - get('3M')!).toFixed(3)  : null,
        '30Y-5Y':   get('30Y') !== null && get('5Y')  !== null ? +(get('30Y')! - get('5Y')!).toFixed(3)  : null,
        '5Y-2Y':    get('5Y')  !== null && get('2Y')  !== null ? +(get('5Y')!  - get('2Y')!).toFixed(3)  : null,
      }

      const data = { curve, spreads }
      await setCache(cacheKey, data, 900)
      return NextResponse.json({ data, source: 'live' })
    }

    if (mode === 'history') {
      // Historical spread data for 10Y-2Y and 10Y-3M
      const [y10, y2, y3m] = await Promise.all([
        fetchFredSeries('DGS10', 500),
        fetchFredSeries('DGS2',  500),
        fetchFredSeries('DGS3MO',500),
      ])
      const dateMap10: Record<string, number | null> = {}
      const dateMap2:  Record<string, number | null> = {}
      const dateMap3m: Record<string, number | null> = {}
      y10.forEach(d => { dateMap10[d.date] = d.value })
      y2.forEach(d =>  { dateMap2[d.date]  = d.value })
      y3m.forEach(d => { dateMap3m[d.date] = d.value })

      const dates = [...new Set([...y10.map(d => d.date), ...y2.map(d => d.date)])].sort()
      const history = dates.slice(-500).map(date => ({
        date,
        y10: dateMap10[date] ?? null,
        y2:  dateMap2[date] ?? null,
        y3m: dateMap3m[date] ?? null,
        spread_10_2:  dateMap10[date] !== null && dateMap2[date] !== null
          ? +(dateMap10[date]! - dateMap2[date]!).toFixed(3) : null,
        spread_10_3m: dateMap10[date] !== null && dateMap3m[date] !== null
          ? +(dateMap10[date]! - dateMap3m[date]!).toFixed(3) : null,
      }))

      await setCache(cacheKey, history, 3600)
      return NextResponse.json({ data: history, source: 'live' })
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Fetch failed'
    return NextResponse.json({ error: msg })
  }
}
