/**
 * Lets a node script import the app's server modules directly — "@/…" paths,
 * extensionless imports and 'server-only' — so it can run them against live data
 * (news-compare.ts, the feed checks in evidence-test.ts). Node ≥ 23.5.
 * Usage: import './serverModules.ts' first, then `await import('../lib/…')`.
 */
import * as nodeModule from 'node:module'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Resolved = { url: string; shortCircuit?: boolean }
type Resolve = (spec: string, ctx: { parentURL?: string }, next: (spec: string, ctx: { parentURL?: string }) => Resolved) => Resolved

const ROOT = path.resolve(import.meta.dirname, '..')
const isFile = (p: string) => existsSync(p) && statSync(p).isFile()

;(nodeModule as unknown as { registerHooks(h: { resolve: Resolve }): void }).registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
    if (spec === 'next/server') return next('next/server.js', ctx) // CommonJS package without an exports map
    const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2))
      : /^\.\.?\//.test(spec) && ctx.parentURL?.startsWith('file:') ? path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec) : null
    if (base) for (const ext of ['', '.ts', '.tsx', '/index.ts']) if (isFile(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
    return next(spec, ctx)
  },
})
