import { NextRequest } from 'next/server'
import { geminiFlash, reserveGeminiCall } from '@/lib/gemini'
import { getTickerSentiment } from '@/lib/apis/reddit'
import { z } from 'zod'
import { parseBody, ticker as tickerSchema } from '@/lib/validation'
import { checkLimits, LIMITS, limiterId, tooManyRequests } from '@/lib/rateLimit'

const Body = z.object({ ticker: tickerSchema })

// SSE stream over Gemini; cap a hung stream well under the 300s platform default.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, Body)
  if (parsed.error) return parsed.error
  const { ticker } = parsed.data
  const mention = await getTickerSentiment(ticker)

  // Counted only when the stream below will call Gemini.
  if (process.env.GEMINI_API_KEY && geminiFlash && mention) {
    const rl = await checkLimits([LIMITS.aiUser(await limiterId(req))])
    if (!rl.ok) return tooManyRequests(rl.retryAfter, 'AI requests today (your share of the shared daily AI quota)')
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      if (!process.env.GEMINI_API_KEY || !geminiFlash) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `Reddit data for ${ticker}: ${mention?.mentions || 0} mentions, sentiment: ${mention?.sentiment || 'UNKNOWN'}` })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      if (!mention) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `No Reddit mentions found for ${ticker} in the last fetch.` })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      const posts = mention.posts.map((p: any) => `• [r/${p.subreddit} · ${p.score}pts] ${p.title}`).join('\n')
      const prompt = `Based on these Reddit posts about ${ticker} (${mention.mentions} mentions, avg score ${mention.avgScore}):\n\n${posts}\n\nSummarize retail investor sentiment in 3 bullet points: (1) overall mood, (2) main bull thesis, (3) main bear concern. Be concise and direct.`

      if (!(await reserveGeminiCall('ondemand'))) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: 'AI daily quota reached — try again after midnight Pacific time.' })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      try {
        const result = await geminiFlash.generateContentStream(prompt)
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `Error: ${err.message}` })}\n\n`))
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
