import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { getQuotes } from '@/lib/apis/yahoo'

const BRIEF_SYSTEM = `You are the head of macro research at a top-tier hedge fund.
Every morning at market open you send your team a tight market brief — 300 words max.
No fluff. No bullet lists. No headers. Continuous prose.
Cover: pre-market sentiment, key movers, macro risks, and one high-conviction trade idea.
Speak in Bloomberg terminal style: direct, data-anchored, confident.`

const DAILY_TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'GLD', 'USO', 'TLT', 'BTC-USD', 'DX-Y.NYB']

const KEY_VALID = (k?: string) =>
  !!k && !k.startsWith('your_') && k !== 'demo' && k.length > 20

interface QSummary {
  symbol: string; price: number; chg: number; chgPct: number; name: string
}

function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` }
function usd(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function generateMockBrief(qs: QSummary[]): string {
  const get = (sym: string) => qs.find(q => q.symbol === sym)
  const spy  = get('SPY')
  const qqq  = get('QQQ')
  const nvda = get('NVDA')
  const tsla = get('TSLA')
  const aapl = get('AAPL')
  const msft = get('MSFT')
  const meta = get('META')
  const btc  = get('BTC-USD')
  const gld  = get('GLD')
  const tlt  = get('TLT')
  const dxy  = get('DX-Y.NYB')

  const spyDir   = (spy?.chgPct ?? 0) >= 0 ? 'extending gains' : 'under pressure'
  const spyStr   = spy  ? `SPY ${spyDir} at ${usd(spy.price)} (${pct(spy.chgPct)})` : 'SPY data pending'
  const qqqStr   = qqq  ? `QQQ ${qqq.chgPct >= 0 ? 'outperforming' : 'lagging'} at ${usd(qqq.price)} (${pct(qqq.chgPct)})` : ''
  const btcStr   = btc  ? `Bitcoin ${btc.chgPct >= 0 ? 'bid' : 'offered'} at ${usd(btc.price)} (${pct(btc.chgPct)})` : ''
  const gldStr   = gld  ? `Gold ${gld.chgPct >= 0 ? 'catching safe-haven flows' : 'retreating'} at ${usd(gld.price)} (${pct(gld.chgPct)})` : ''
  const dxyStr   = dxy  ? `Dollar Index ${dxy.chgPct >= 0 ? 'strengthening' : 'softening'} at ${dxy.price.toFixed(2)} (${pct(dxy.chgPct)})` : ''
  const tltStr   = tlt  ? `TLT ${tlt.chgPct >= 0 ? 'catching a bid' : 'selling off'} at ${usd(tlt.price)} (${pct(tlt.chgPct)})` : ''

  // Pick biggest mover in tech for spotlight
  const techMoves = [nvda, tsla, aapl, msft, meta].filter(Boolean) as QSummary[]
  const bigMover  = techMoves.sort((a, b) => Math.abs(b.chgPct) - Math.abs(a.chgPct))[0]
  const moverStr  = bigMover
    ? `${bigMover.name || bigMover.symbol} (${bigMover.symbol}) is the session's standout at ${usd(bigMover.price)} (${pct(bigMover.chgPct)})`
    : ''

  // Risk tone
  const riskOn  = (spy?.chgPct ?? 0) > 0.3
  const riskOff = (spy?.chgPct ?? 0) < -0.5
  const tone    = riskOn ? 'risk-on' : riskOff ? 'risk-off' : 'mixed'
  const toneStr = riskOn
    ? 'risk appetite intact — equities broadly higher'
    : riskOff
    ? 'de-risking dominant — equities selling off across the board'
    : 'mixed signals — tape grinding with no clear directional conviction'

  // Trade idea
  let tradeIdea = ''
  if (nvda && nvda.chgPct < -1.5) {
    tradeIdea = `High-conviction setup: NVDA dip at ${usd(nvda.price)} looks compelling given secular AI capex tailwinds — buy the pullback with a tight stop below the 50-day.`
  } else if (btc && btc.chgPct > 2) {
    tradeIdea = `Crypto momentum: BTC clearing ${usd(btc.price)} with force — a break above near-term resistance targets a move to the next Fibonacci level. Watch ETH for confirmation.`
  } else if (gld && gld.chgPct > 0.5) {
    tradeIdea = `Gold's bid (${pct(gld.chgPct)}) signals macro unease — GLD calls or a direct position offer asymmetric upside if the Fed signals a pause.`
  } else if (tlt && tlt.chgPct > 0.5) {
    tradeIdea = `Bond rally in TLT (${pct(tlt.chgPct)}) reads as a flight-to-safety — pair a long TLT with short XLK if growth scare deepens.`
  } else if (spy && spy.chgPct > 0.5) {
    tradeIdea = `Momentum trade: SPY holding above its 20-day with breadth expanding — add exposure on any intraday pullback toward ${usd(spy.price * 0.995)}.`
  } else {
    tradeIdea = `Stay defensive: with ${tone} tape and macro uncertainty elevated, rotate into quality large-cap dividend names and trim speculative beta.`
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })

  const paragraphs = [
    `Markets opened ${timeStr} ET — ${toneStr}. ${spyStr}${qqqStr ? `; ${qqqStr}` : ''}. ${dxyStr ? `${dxyStr}, ${dxy!.chgPct > 0 ? 'weighing on' : 'tailwind for'} dollar-sensitive multinationals. ` : ''}${tltStr ? `${tltStr} — ${tlt!.chgPct > 0 ? 'bond market sniffing out slowing growth' : 'yields pushing higher on resilient data'}. ` : ''}`,

    `${moverStr ? `On the single-name front, ${moverStr}${bigMover.chgPct > 0 ? ', driven by momentum buying and positive flow data' : ', hit by profit-taking after a strong run'}. ` : ''}${btcStr ? `${btcStr}, ${btc!.chgPct > 0 ? 'tracking risk appetite higher and drawing rotation from speculative equity names' : 'reflecting broad de-risking with correlated selling across growth assets'}. ` : ''}${gldStr ? `${gldStr}. ` : ''}`,

    `Macro backdrop remains the key wildcard. Rate expectations are fluid — any Fed speak today warrants close attention. ${dxy ? `Dollar ${dxy.chgPct >= 0 ? 'strength' : 'weakness'} is a structural headwind for${dxy.chgPct >= 0 ? ' EM and commodity names' : ' domestic-focused small caps'}.` : ''} Positioning data suggests institutional flows are ${riskOn ? 'chasing upside momentum — watch for an intraday fade if breadth deteriorates' : riskOff ? 'defensively positioned — any positive catalyst could trigger a sharp short squeeze' : 'neutral, with options activity bunched near current strikes suggesting range-bound trade'}.`,

    tradeIdea,
  ]

  return paragraphs.filter(Boolean).join('\n\n')
}

async function streamText(text: string): Promise<ReadableStream> {
  const encoder = new TextEncoder()
  // Stream word-by-word for a realistic typing effect
  const words = text.split(' ')
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? '' : ' ') + words[i]
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        // Small delay per word to simulate streaming
        await new Promise(r => setTimeout(r, 18))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const encoder = new TextEncoder()

  // Cache brief for 1 hour — regenerate at most once per hour
  const cacheKey = `ai_brief_${new Date().toISOString().slice(0, 13)}` // hourly key
  const cached = getCache(cacheKey)
  if (cached && !cached.stale) {
    const text = cached.data as string
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  // Fetch live market data (always — used by both AI and mock paths)
  let quotes: QSummary[] = []
  try {
    const raw = await getQuotes(DAILY_TICKERS)
    quotes = raw.map((q: any) => ({
      symbol: q.symbol,
      price:  q.regularMarketPrice ?? 0,
      chg:    q.regularMarketChange ?? 0,
      chgPct: q.regularMarketChangePercent ?? 0,
      name:   q.shortName || q.symbol,
    }))
  } catch { /* proceed with empty quotes */ }

  // ── Path A: Real Claude AI (when key is configured) ───────────────────────
  if (KEY_VALID(apiKey)) {
    const snapshot = quotes.length
      ? quotes.map(q => `${q.symbol}: ${usd(q.price)} (${pct(q.chgPct)})`).join(', ')
      : 'Live data temporarily unavailable'

    const now = new Date().toUTCString()
    const userPrompt = `Morning brief request — ${now}\n\nLive market snapshot:\n${snapshot}\n\nDeliver today's morning brief.`

    const client = new Anthropic({ apiKey: apiKey! })
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: BRIEF_SYSTEM,
            messages: [{ role: 'user', content: userPrompt }],
          })

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullText += event.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
            }
          }

          if (fullText) setCache(cacheKey, fullText, 3600)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err: any) {
          // On auth failure, fall through to mock brief
          const mockText = generateMockBrief(quotes)
          setCache(cacheKey, mockText, 3600)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: mockText })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
    })
  }

  // ── Path B: Template-based brief from live data (no API key needed) ───────
  const mockText = generateMockBrief(quotes)
  setCache(cacheKey, mockText, 3600)

  const readable = await streamText(mockText)
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
  })
}
