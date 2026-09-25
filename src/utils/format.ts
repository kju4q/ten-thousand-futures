import type { Scenario } from '../simulation/scenarioTypes'

export function formatOutcome(value: number, scenario: Scenario, compact = true): string {
  return new Intl.NumberFormat(scenario.locale, {
    style: scenario.outputFormat === 'currency' ? 'currency' : 'decimal',
    currency: scenario.currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }).format(value)
}
