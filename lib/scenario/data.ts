import 'server-only'
// The sensitivity file, bundled with the server (no runtime Yahoo calls), and
// results memoised per parameter set: the data only changes on deploy.
import raw from '@/data/scenario/sensitivities.json'
import { runScenario, type ScenarioInput, type ScenarioResult, type SensitivityData } from './engine'

export const SENSITIVITIES = raw as unknown as SensitivityData

const memo = new Map<string, ScenarioResult>()
/** runScenario with a per-instance memo (bounded: custom shocks make the key space open-ended). */
export function scenarioCached(input: ScenarioInput): ScenarioResult {
  const key = JSON.stringify(input)
  const hit = memo.get(key)
  if (hit) return hit
  const r = runScenario(SENSITIVITIES, input)
  if (memo.size >= 500) memo.clear()
  memo.set(key, r)
  return r
}

/** Days since the sensitivity file was built (for /admin/health). */
export const sensitivityAgeDays = (now = Date.now()) => (now - Date.parse(SENSITIVITIES.meta.generatedAt)) / 86400_000
