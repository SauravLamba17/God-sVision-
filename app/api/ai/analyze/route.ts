import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const PANEL_SYSTEM = `You are a senior quantitative analyst and portfolio strategist with 20 years on the trading desk.
You have direct access to live terminal data from GOD's Vision — a Bloomberg-grade financial intelligence platform.
Deliver analysis in crisp, terminal-style prose: no bullet lists, no headers, no markdown.
Speak in facts, signals, and conviction. Under 250 words. Start immediately with the key insight.`

const KEY_VALID = (k?: string) =>
  !!k && !k.startsWith('your_') && k !== 'demo' && k.length > 20

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!KEY_VALID(apiKey)) {
    return new Response(
      `data: ${JSON.stringify({ error: 'Add ANTHROPIC_API_KEY to .env.local to enable AI analysis (console.anthropic.com)' })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )
  }

  const { panelData, panelName, context } = await req.json()
  const client = new Anthropic({ apiKey })

  const userPrompt = `Live ${panelName} feed — ${new Date().toUTCString()}:\n\n${JSON.stringify(panelData, null, 2)}${context ? `\n\nAdditional context: ${context}` : ''}\n\nGive your analysis.`

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: PANEL_SYSTEM,
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            )
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: err.message || 'Analysis failed' })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
