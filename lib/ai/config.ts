// AI configuration — all from env so a paid provider needs no code changes.
//   AI_PROVIDER                 gemini | none   (default none → deterministic summaries only)
//   AI_NARRATION_DAILY_LIMIT    narration calls per Pacific day   (default 4, Gemini free-tier friendly)
//   AI_NARRATION_TTL_SECONDS    how long one narration batch is reused (default 7200)
//   AI_NARRATION_BATCH          movers per call, max 5             (default 5)
//   AI_BRAIN_DAILY_LIMIT        Market Brain prose calls per market per Pacific day (default 3)
//   AI_BRAIN_TTL_SECONDS        how long one Market Brain prose is reused          (default 14400 = 4h)
const int = (v: string | undefined, d: number, min: number, max: number) => {
  const n = parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d
}

export const aiConfig = () => ({
  provider: (process.env.AI_PROVIDER ?? 'none').trim().toLowerCase(),
  narrationDailyLimit: int(process.env.AI_NARRATION_DAILY_LIMIT, 4, 0, 10_000),
  narrationTtlSeconds: int(process.env.AI_NARRATION_TTL_SECONDS, 7200, 300, 86_400),
  narrationBatch: int(process.env.AI_NARRATION_BATCH, 5, 1, 5),
  brainDailyLimit: int(process.env.AI_BRAIN_DAILY_LIMIT, 3, 0, 1_000),
  brainTtlSeconds: int(process.env.AI_BRAIN_TTL_SECONDS, 14_400, 900, 86_400),
})
