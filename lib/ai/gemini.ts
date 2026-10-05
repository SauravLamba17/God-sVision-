import 'server-only'
import { SchemaType } from '@google/generative-ai'
import { genAI, reserveGeminiCall } from '@/lib/gemini'
import { track } from '@/lib/feedHealth'
import type { AIProvider, NarrationItem } from './types'

const SYSTEM = `You rewrite market evidence into short, fluent sentences for a trading terminal.
Rules — follow exactly:
- Use ONLY the evidence given for each item. Do not add any cause, fact, number, company or event that is not in it.
- The evidence shows correlation, not proof. Use "moved with", "coincides with", "alongside", "related". Never write "because", "caused", "due to", "driven by", "thanks to", "triggered", "sparked" or "fuelled".
- Do not state the item's own price or percentage move (the screen shows it live). Other figures may be quoted exactly as given.
- If the evidence says no clear driver was found, say so plainly.
- One or two sentences, at most 220 characters, per item.`

export function geminiProvider(): AIProvider | null {
  if (!genAI) return null
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: { id: { type: SchemaType.STRING }, text: { type: SchemaType.STRING } },
              required: ['id', 'text'],
            },
          },
        },
        required: ['items'],
      },
    },
  })
  return {
    name: 'Gemini',
    async narrate(items: NarrationItem[]) {
      if (process.env.NEXT_PHASE === 'phase-production-build') throw new Error('AI disabled during build')
      if (!(await reserveGeminiCall('scheduled'))) throw new Error('Gemini daily budget reached')
      const prompt = `${SYSTEM}\n\nEvidence (JSON):\n${JSON.stringify(items)}`
      const res = await track('Gemini', () => model.generateContent(prompt))
      const parsed = JSON.parse(res.response.text()) as { items?: { id: string; text: string }[] }
      return Object.fromEntries((parsed.items ?? []).map(i => [i.id, i.text]))
    },
  }
}
