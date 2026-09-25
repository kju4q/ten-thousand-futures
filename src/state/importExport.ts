import { validateScenario } from '../simulation/scenarioValidation'
import type { Scenario } from '../simulation/scenarioTypes'

export function exportScenario(scenario: Scenario): void {
  const blob = new Blob([`${JSON.stringify(scenario, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${scenario.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function importScenario(file: File): Promise<Scenario> {
  const parsed: unknown = JSON.parse(await file.text())
  const validation = validateScenario(parsed)
  if (!validation.scenario) throw new Error(validation.issues.map((issue) => issue.message).join(' '))
  return validation.scenario
}
