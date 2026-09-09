'use client'
import { useEffect, useRef, useState } from 'react'
import { ACCENT, INK, UP } from '@/lib/canvas/globe'

/** One line of the analysis-desk transcript: [kind, text]. */
export type AIScriptLine = [AILineKind, string]
export type AILineKind = 'cmd' | 'dim' | 'hl' | 'txt' | 'acc' | 'gap'

/** The desk transcript, verbatim from the approved design. */
export const AI_SCRIPT: AIScriptLine[] = [
  ['cmd', '> desk analyze --tape 24h --watchlist core'],
  ['dim', '  connecting gv://wire · equities, crypto, FX ....... ok'],
  ['dim', '  ingesting wires, filings & RSS .................... ok'],
  ['dim', '  scoring against open positions .................... ok'],
  ['gap', ''],
  ['hl', 'MORNING BRIEF — 08:52 ET'],
  ['txt', 'Semis carried the tape overnight on a Taiwan capacity note'],
  ['txt', '(Nikkei, 04:12 ET). NVDA held 128 through Asia, but the bid'],
  ['txt', 'thinned after 07:30 — spread widened 3.4× vs 20 d median.'],
  ['gap', ''],
  ['txt', 'Your exposure: 14.2% semis, concentrated in two names.'],
  ['txt', 'USDINR at 83.19 clips the India sleeve by 41 bps unhedged.'],
  ['gap', ''],
  ['acc', '  ⟩ WATCH   NVDA 126.80 — prior demand shelf, 3 tests'],
  ['acc', '  ⟩ FLAG    M 4.6 Honshu 06:41Z — JPY unmoved, monitoring'],
  ['acc', '  ⟩ SOURCE  6 wires cited · confidence 0.72 · trace 0413'],
  ['gap', ''],
  ['cmd', '> _'],
]

export const AI_LINE_COLORS: Record<AILineKind, string> = {
  cmd: ACCENT,
  dim: 'rgba(' + INK + ',.45)',
  hl: '#e8e6e1',
  txt: 'rgba(' + INK + ',.8)',
  acc: UP,
  gap: 'transparent',
}

/** Default characters-per-tick interval — the design's `aiTypingSpeed` prop. */
const SPEED_MS = 14
/** The reference reveals two characters per tick. */
const CHARS_PER_TICK = 2

export interface TypewriterState {
  /** Fully-typed lines, plus the partially-typed one at the end. */
  lines: AIScriptLine[]
  /** True once the whole script has been revealed. */
  done: boolean
  /** True until the observer fires — the panel shows its idle placeholder. */
  idle: boolean
  /** Cursor should blink only while animating. */
  blink: boolean
}

/**
 * Drives the analysis-desk typewriter.
 *
 * Ported from the reference's startAI(): an IntersectionObserver at threshold
 * 0.25 starts it once, characters land two at a time on a 14ms interval, and
 * prefers-reduced-motion reveals the whole script instantly instead. All
 * matchMedia/observer work happens in an effect, so the first client render
 * matches the server's idle placeholder exactly.
 */
export function useTypewriter(
  targetRef: React.RefObject<HTMLElement>,
  speed = SPEED_MS,
): TypewriterState {
  const [state, setState] = useState<TypewriterState>({
    lines: [], done: false, idle: true, blink: false,
  })
  const startedRef = useRef(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el || startedRef.current) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (startedRef.current) return
      startedRef.current = true

      if (reduced) {
        setState({ lines: AI_SCRIPT, done: true, idle: false, blink: false })
        return
      }

      setState({ lines: [], done: false, idle: false, blink: true })

      let li = 0, ci = 0
      timer = setInterval(() => {
        if (li >= AI_SCRIPT.length) {
          clearInterval(timer)
          setState(s => ({ ...s, done: true, blink: true }))
          return
        }
        const [kind, text] = AI_SCRIPT[li]
        if (ci < text.length) {
          ci += CHARS_PER_TICK
          const partial = text.slice(0, ci)
          const upTo = li
          setState(s => ({
            ...s,
            lines: [...AI_SCRIPT.slice(0, upTo), [kind, partial] as AIScriptLine],
          }))
        } else {
          li++
          ci = 0
        }
      }, speed)
    }

    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); start() }
    }, { threshold: 0.25 })
    io.observe(el)

    return () => { io.disconnect(); if (timer) clearInterval(timer) }
  }, [targetRef, speed])

  return state
}
