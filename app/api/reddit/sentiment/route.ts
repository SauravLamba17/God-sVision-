import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getTickerSentiment } from '@/lib/apis/reddit'

export async function POST(req: NextRequest) {
  const { ticker } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  const mention = await getTickerSentiment(ticker?.toUpperCase())

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
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
      const client = new Anthropic({ apiKey })
      const stream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Based on these Reddit posts about ${ticker} (${mention.mentions} mentions, avg score ${mention.avgScore}):\n\n${posts}\n\nSummarize retail investor sentiment in 3 bullet points: (1) overall mood, (2) main bull thesis, (3) main bear concern. Be concise and direct.`,
        }],
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
