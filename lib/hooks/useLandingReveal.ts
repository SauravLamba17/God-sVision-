'use client'
import { useEffect } from 'react'

/**
 * Settles the [data-reveal] rise-in animations.
 *
 * Ported from the reference design's setupReveal(). The animation itself is
 * pure CSS (gv-rise, upgraded to a scroll-linked `animation-timeline: view()`
 * where supported); this hook only does what the reference's JS did:
 *
 *  - under prefers-reduced-motion, strips the animation outright;
 *  - once an element has been on screen for 900ms, pins it visible and stops
 *    observing, so a scroll-linked reveal plays once rather than re-running
 *    every time it re-enters;
 *  - sweeps anything within 1.2 viewports after 2.5s as a safety net, so no
 *    section can ever be left stuck at opacity 0.
 *
 * Runs once from the landing page root. matchMedia is read inside the effect.
 */
export function useLandingReveal(): void {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!reveals.length) return

    const clear = (el: HTMLElement) => {
      el.style.animation = 'none'
      el.style.opacity = '1'
      el.style.transform = 'none'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reveals.forEach(el => { el.style.animation = 'none'; el.style.opacity = '1' })
      return
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        setTimeout(() => clear(e.target as HTMLElement), 900)
        io.unobserve(e.target)
      })
    }, { threshold: 0.01 })
    reveals.forEach(el => io.observe(el))

    const sweep = setTimeout(() => reveals.forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight * 1.2) clear(el)
    }), 2500)

    return () => { io.disconnect(); clearTimeout(sweep) }
  }, [])
}
