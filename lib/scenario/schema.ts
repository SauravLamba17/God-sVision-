import { z } from 'zod'
import { FACTOR_IDS } from './factors'
import { PRESETS } from './presets'

// Shared request schema: a preset, or one factor with a shock (range checked by the engine's validateShock).
const presetIds = PRESETS.map(p => p.id) as [string, ...string[]]
export const ScenarioParams = z.union([
  z.object({ preset: z.enum(presetIds) }),
  z.object({ factor: z.enum(FACTOR_IDS as [string, ...string[]]), shock: z.coerce.number().finite().min(-1000).max(1000) }),
])
export const marketParam = z.string().trim().toUpperCase().pipe(z.enum(['US', 'IN']))
