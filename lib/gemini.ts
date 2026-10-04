import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('[Gemini] GEMINI_API_KEY not set');
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiFlash = genAI?.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
});

// `next build` prerenders static/ISR routes (e.g. /api/narratives), which used
// to spend free-tier Gemini quota (20 req/day) on every deploy. Callers already
// handle a thrown error with their cached/unavailable path.
function assertNotBuilding() {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    throw new Error('Gemini disabled during next build');
  }
}

// ── Daily budget ─────────────────────────────────────────────────────────────
// The free tier allows 20 generate calls/day (resets midnight Pacific). Two
// global counters in Postgres (shared by every instance, unlike the in-memory
// cache) cap usage at 10 scheduled + 8 on-demand = 18/day:
//   scheduled — morning brief, narratives, analyst (cached globally, see lib/aiCache.ts)
//   ondemand  — ⚡ AI buttons, per-stock analyst, headline sentiment
export type GeminiKind = 'scheduled' | 'ondemand';
const DAILY_CAP: Record<GeminiKind, number> = { scheduled: 10, ondemand: 8 };

/** Atomically counts one call against today's budget; false once it's spent. */
export async function reserveGeminiCall(kind: GeminiKind): Promise<boolean> {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const key = `gemini_budget:${day}:${kind}`;
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      INSERT INTO "CachedData" ("key", "value", "updatedAt", "expiresAt")
      VALUES (${key}, '1', now(), now() + interval '2 days')
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (("CachedData"."value")::int + 1)::text, "updatedAt" = now()
      RETURNING "value"`;
    return Number(rows[0]?.value) <= DAILY_CAP[kind];
  } catch (e) {
    console.error('[Gemini] budget check failed — refusing call:', e);
    return false; // fail closed: an unknown count must not burn quota
  }
}

async function guard(kind: GeminiKind) {
  if (!geminiFlash) throw new Error('GEMINI_API_KEY not configured');
  assertNotBuilding();
  if (!(await reserveGeminiCall(kind))) throw new Error(`Gemini daily ${kind} budget reached`);
}

export async function geminiGenerate(prompt: string, systemPrompt?: string, kind: GeminiKind = 'ondemand'): Promise<string> {
  await guard(kind);
  if (!geminiFlash) throw new Error('GEMINI_API_KEY not configured');
  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    const result = await geminiFlash.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (e: any) {
    console.error('[Gemini] Error:', e.message);
    throw e;
  }
}

export async function geminiStream(
  prompt: string,
  systemPrompt?: string,
  onChunk?: (text: string) => void,
  kind: GeminiKind = 'ondemand'
): Promise<string> {
  await guard(kind);
  if (!geminiFlash) throw new Error('GEMINI_API_KEY not configured');
  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    const result = await geminiFlash.generateContentStream(fullPrompt);
    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      if (onChunk) onChunk(text);
    }
    return fullText;
  } catch (e: any) {
    console.error('[Gemini] Stream error:', e.message);
    throw e;
  }
}
