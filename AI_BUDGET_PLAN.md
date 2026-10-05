# AI Plan — evidence first, AI optional

_Roadmap: Entity Graph → Evidence Engine + Why Engine → AI Market Brain → Scenario Engine → Research Agent._
_Revised 2026-10-05: the roadmap is no longer built around the Gemini quota._

## Principles

1. **Every mover gets real analysis, free, always.** The analysis is computed in code from data the app already
   fetches (the Evidence Engine), then turned into a one-line explanation by a deterministic template. This is what
   every user sees, whether or not AI is available.
2. **AI is optional narration.** When available, an AI provider may rewrite the evidence into fluent text. It may
   only use the evidence it was given and must never add causes. AI text is always labelled as AI. When AI is
   unavailable or over budget, the deterministic summary shows. Nothing breaks and nothing is hidden.
3. **The provider is pluggable by config.** `lib/ai/` exposes one interface. Gemini is the implementation today,
   selected with `AI_PROVIDER=gemini`. A paid provider is a new implementation file plus env vars, with no
   feature-code changes. Budgets and limits come from config, not code.

## Architecture

```
data the app already fetches (quotes, sector/peer moves, news, earthquakes, outbreaks,
flights, weather, FX/commodities, earnings & macro calendars, volume)
        │
        ▼
Entity Graph (lib/graph) ── which entities a headline/event touches; who is linked to whom
        │
        ▼
Evidence Engine (code only) ── candidate drivers, each with score · evidence · source link · timestamp
        │                      ("no clear driver found" is a valid result)
        ├──▶ Deterministic summary (template) ── shown to everyone, always
        │
        └──▶ AI narration (optional, lib/ai provider) ── rewrites the SAME evidence; labelled "AI";
                                                          rejected if it cites anything not supplied
```

## Accuracy rules (mandatory for every explanation)

- **Live prices only.** Prices and percentages on screen always come from live data, never from inside cached
  text. Templates and AI output refer to moves through placeholders that the UI fills with live values.
- **Snapshot stored.** Every explanation stores the snapshot it was based on (price, % move, time).
- **Recompute on change.** If the live move flips direction, or drifts more than **1.5 percentage points** from the
  snapshot, the evidence is recomputed. It's cheap, and an outdated explanation is never shown as current.
- **Generated time always shown.** A previous day's analysis is never shown as current.
- **Tested.** Tests prove that a flipped or drifted move triggers recomputation (Phase 2).

## Performance rules

- The Evidence Engine runs only on data the app already fetches, with **no new polling**.
- Results are cached briefly and shared across users.
- **No per-request database writes.**
- Every phase reports its CPU impact.

## AI provider layer (Phase 2)

`lib/ai/` will provide:

- `AIProvider` interface: `narrate(evidence, schema)` → validated structured output, or `null`.
- `gemini.ts` implementation (current model `gemini-2.5-flash-lite`), selected by `AI_PROVIDER`. Unset or `none`
  means deterministic summaries only.
- Limits from config:
  - `AI_DAILY_LIMIT` — total calls per day; defaults to the Gemini free tier's ~20.
  - `AI_SAFETY_MARGIN`
  - per-feature shares.

  These are enforced with the existing atomic Postgres counters (no schema change). A paid provider raises the
  limits through env vars only.
- Every AI output is checked with zod and against the supplied evidence ids. Any claim citing something not
  supplied is dropped, and the deterministic summary is used instead.

## Gemini calls today (after the 2026-10-05 changes)

| Feature | Trigger | Cache | Calls/day max | Fallback |
|---|---|---|---|---|
| Morning brief (`/api/ai/brief`) | Dashboard load | Postgres, 24h per mode | 2 | last brief with "generated at" time |
| Narratives (`/api/narratives`) | Dashboard load / ISR | Postgres, 8h | 3 | last narratives with time |
| Per-stock deep dive (`/api/analyst/stock`) | Opening a deep dive | Postgres, 6h per ticker | on-demand pool | rule-based verdict, **ESTIMATE** |
| ⚡ AI analyze (`/api/ai/analyze`) | User click | none | on-demand pool | 429 "quota reached" |

Removed on 2026-10-05:

- **Market analyst Gemini call.** It never succeeded (its reply was cut off at the output-token limit), retried
  every 30 minutes and drained the scheduled pool. The panel now shows its rule-based synthesis, labelled
  **ESTIMATE**.
- **Headline sentiment via Gemini.** It is now keyword-based: no AI, no database lookups, labelled
  **keyword estimate**.
- **`/api/reddit/sentiment` and `/api/ai/sentiment`.** Deleted; nothing in the app called them.

Real usage: the budget counters (`gemini_budget:<PT day>:<pool>`) show 11 scheduled and 10 on-demand attempts on
2026-10-04, a deploy and testing day. With the analyst drain and headline batches gone, the remaining design
maximum is **5 scheduled + ≤8 on-demand**, well under the free tier.

## How later phases use AI

| Phase | AI role | Without AI |
|---|---|---|
| 2 · Why Engine | Optional narration of the evidence for up to 5 movers per call (structured JSON, cited evidence ids only) | Deterministic one-line summary for every mover |
| 3 · Market Brain | Optional narration that replaces the separate brief and narratives calls (2 → 1 call per generation) | Template brief built from evidence and the market overview |
| 4 · Scenario Engine | None (rules over the entity graph) | — |
| 5 · Research Agent | Optional synthesis of a deterministic data pack | The data pack itself, clearly sectioned |

When the AI budget is used up, every feature falls back to the deterministic output. Because the deterministic
output **is** the analysis, nothing degrades to "unavailable" for lack of AI.
