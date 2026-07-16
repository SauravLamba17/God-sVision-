import { NextRequest } from 'next/server'
import { geminiFlash } from '@/lib/gemini'
import { getTickerSentiment } from '@/lib/apis/reddit'

export async function POST(req: NextRequest) {
  const { ticker } = await req.json()
  const mention = await getTickerSentiment(ticker?.toUpperCase())

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
