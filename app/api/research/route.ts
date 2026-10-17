import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseBody } from '@/lib/validation'
import { checkLimits, LIMITS, tooManyRequests } from '@/lib/rateLimit'
import { ResearchBody, parseQuestion } from '@/lib/research/parse'
import { gatherFacts } from '@/lib/research/facts'
import { composeAnswer } from '@/lib/research/answer'
import { narrateAnswer } from '@/lib/research/narrate'

// Research Agent: a plain question → a sourced answer from the app's engines. Works fully
// without AI; with AI_PROVIDER set, an optional AI rewrite of the same facts (validated, labelled).
// Public-data answers reuse the shared caches (fetch Data Cache, engine caches, AI cache keyed
// without user data). Portfolio answers read only this user's rows and are never cached anywhere.
// Answers return within 8 s: facts get a 7.5 s budget, AI prose only what is left.
const NO_STORE = { 'Cache-Control': 'no-store' }
const PRIVATE = { 'Cache-Control': 'private, no-store' }
const TOTAL_MS = 8000

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id ?? null
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: PRIVATE })
  const parsed = await parseBody(req, ResearchBody, PRIVATE)
  if (parsed.error) return parsed.error
  const rl = await checkLimits([LIMITS.research(userId)])
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'research questions', PRIVATE)
  try {
    const t1 = Date.now()
    const p = parseQuestion(parsed.data.question, parsed.data.market)
    const t2 = Date.now()
    const fs = await gatherFacts(p, p.intent === 'PORTFOLIO' ? userId : null, { budgetMs: Math.min(7500, TOTAL_MS - 500 - (t2 - t0)) })
    const t3 = Date.now()
    const answer = composeAnswer(fs)
    const t4 = Date.now()
    // AI only for public answers, and only with enough time left to stay inside the 8 s.
    const left = TOTAL_MS - (t4 - t0) - 300
    const prose = !fs.private && left >= 1500 ? await narrateAnswer(fs, userId, Math.min(8000, left)) : null
    const t5 = Date.now()
    return NextResponse.json({
      answer: prose ? { ...answer, ai: prose } : answer,
      facts: fs.facts,
      sources: answer.sources,
      mode: prose ? 'ai' : 'automatic',
      dataStatus: fs.dataStatus,
      intent: p.intent, market: p.market, window: p.window,
      timings: { limitMs: t1 - t0, parseMs: t2 - t1, factsMs: t3 - t2, answerMs: t4 - t3, aiMs: t5 - t4, totalMs: t5 - t0 },
    }, { headers: fs.private ? PRIVATE : NO_STORE })
  } catch (e) {
    console.error('[research]', (e as Error).message)
    return NextResponse.json({ error: 'Could not answer that right now. Try again in a minute.' }, { status: 500, headers: PRIVATE })
  }
}
