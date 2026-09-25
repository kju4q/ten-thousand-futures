import { validateScenario } from '../simulation/scenarioValidation'
import type { Scenario } from '../simulation/scenarioTypes'

export const STORAGE_KEY = 'ten-thousand-futures:scenario:v1'

export function saveScenario(scenario: Scenario): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario))
}

export function loadScenario(): { scenario?: Scenario; notice?: string } {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    const validation = validateScenario(parsed)
    if (validation.scenario) return { scenario: validation.scenario }
  } catch { /* recover below */ }
  return { notice: 'Saved scenario could not be restored. The demo has been loaded.' }
}
