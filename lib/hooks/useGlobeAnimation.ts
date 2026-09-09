'use client'
import { useEffect, useRef } from 'react'
import {
  buildSphere, drawGlobe, sizeCanvas,
  type GlobeOptions, type SizedCanvas, type Sphere,
} from '@/lib/canvas/globe'

/** Given the sized canvas and the elapsed seconds, produce this frame's camera.
 *  Return null to skip drawing. Hero and World use different curves, so this
 *  is the only part the caller supplies. */
export type GlobeFrameFn = (
  canvas: SizedCanvas,
  t: number,
  reduced: boolean,
) => GlobeOptions | null

/**
 * The shared requestAnimationFrame driver for a landing-page globe canvas.
 *
 * Ported from the reference design's DCLogic frame()/kick() pair: an
 * IntersectionObserver gates work to when the canvas is near the viewport, the
 * loop pauses entirely on a hidden tab, and frames are throttled to ~30fps by
 * the 32ms floor. Under prefers-reduced-motion it draws exactly one static
 * frame at t=0 instead of animating, redrawing only on resize or re-entry.
 *
 * Every window/matchMedia read happens here, inside an effect — never during
 * render — so the server and client first paints agree.
 */
export function useGlobeAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  frameFn: GlobeFrameFn,
  density?: number,
): void {
  // Keep the latest callback without restarting the loop on every render.
  const frameFnRef = useRef(frameFn)
  frameFnRef.current = frameFn

  useEffect(() => {
    const canvas = canvasRef.current as SizedCanvas | null
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let sphere: Sphere | null = null
    let raf = 0
    let lastFrame = 0
    let visible = false
    let staticDrawn = false
    let loggedErr = false
    const t0 = performance.now()

    // The O(n²) link pass is memoised in buildSphere, but keep it off the
    // first paint's critical path regardless.
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(cb, { timeout: 400 })
        : window.setTimeout(cb, 1)

    const frameBody = (now: number) => {
      if (!sphere) return
      const t = reduced ? 0 : (now - t0) / 1000
      const opts = frameFnRef.current(canvas, t, reduced)
      if (!opts) return
      drawGlobe(canvas, sphere, { showFlightPaths: !reduced, ...opts })
    }

    const frame = (now: number) => {
      raf = 0
      if (document.hidden) return
      const live = visible && !reduced
      const needsStatic = visible && reduced && !staticDrawn
      if (!live && !needsStatic) return
      if (now - lastFrame < 32) { raf = requestAnimationFrame(frame); return }
      lastFrame = now
      try {
        frameBody(now)
        staticDrawn = true
      } catch (err) {
        // One bad frame must not spam the console or kill the loop.
        if (!loggedErr) { loggedErr = true; console.error('gv frame error', err) }
      }
      if (live) raf = requestAnimationFrame(frame)
    }

    const kick = () => {
      if (!raf && !document.hidden) { lastFrame = 0; raf = requestAnimationFrame(frame) }
    }

    sizeCanvas(canvas)
    idle(() => { sphere = buildSphere(density); staticDrawn = false; kick() })

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { visible = e.isIntersecting })
      if (visible) { staticDrawn = false; kick() }
    }, { rootMargin: '140px 0px' })
    io.observe(canvas)

    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0 }
      else { staticDrawn = false; kick() }
    }
    const onResize = () => { sizeCanvas(canvas); staticDrawn = false; kick() }
    const onScroll = () => { if (visible) kick() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [canvasRef, density])
}
