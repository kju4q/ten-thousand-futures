import { sampleVariable } from '../simulation/distributions'
import type { Scenario, ScenarioVariable, SimulationResult } from '../simulation/scenarioTypes'
import { formatOutcome } from '../utils/format'

export interface FutureSample {
  label: string
  value: string
}

export interface FutureStory {
  title: string
  story: string
  detail: string
  samples: FutureSample[]
}

function formatSample(variable: ScenarioVariable, value: number, scenario: Scenario): string {
  if (variable.type === 'bernoulli') return value ? 'yes' : 'no'
  if (variable.display.unit === 'currency') return formatOutcome(value, scenario)
  if (variable.display.unit === 'percent') return new Intl.NumberFormat(scenario.locale, { style: 'percent', maximumFractionDigits: 0 }).format(value)
  if (variable.display.unit === 'years') return `${new Intl.NumberFormat(scenario.locale, { maximumFractionDigits: 1 }).format(value)} ${value === 1 ? 'year' : 'years'}`
  return new Intl.NumberFormat(scenario.locale, { maximumFractionDigits: 1 }).format(value)
}

export function sampleFutureVariables(scenario: Scenario, futureId: number): Record<string, number> {
  const values: Record<string, number> = Object.create(null) as Record<string, number>
  for (const variable of scenario.variables) values[variable.key] = sampleVariable(variable, scenario.seed, futureId)
  return values
}

export function createFutureStory(scenario: Scenario, result: SimulationResult, futureId: number): FutureStory {
  const values = sampleFutureVariables(scenario, futureId)
  const winner = result.winners[futureId]
  const first = winner === 1 ? 1 : 0
  const second = first === 0 ? 1 : 0
  const outcomes = [result.outcomesA[futureId], result.outcomesB[futureId]]
  const displayId = new Intl.NumberFormat(scenario.locale).format(futureId + 1)
  const runCount = new Intl.NumberFormat(scenario.locale).format(scenario.runs)
  const title = `future no. ${displayId} of ${runCount}`
  const story = `${scenario.options[first].name} ends at ${formatOutcome(outcomes[first], scenario)} and ${scenario.options[second].name} at ${formatOutcome(outcomes[second], scenario)} in this simulated run.`
  const success = scenario.variables.find((variable) => variable.key === 'startup_succeeds')
  const years = values.years
  const detail = success
    ? `Startup success was sampled ${values[success.key] ? 'yes' : 'no'}${Number.isFinite(years) ? ` across the ${formatSample(scenario.variables.find((variable) => variable.key === 'years') ?? success, years, scenario)} horizon` : ''}.`
    : winner === 2 ? 'The two options finish evenly in this simulated run.' : `${scenario.options[winner].name} finishes ahead in this simulated run.`
  const preferredKeys = ['bonus_a', 'equity_b', 'startup_succeeds']
  const variables = [...scenario.variables].sort((a, b) => {
    const aRank = preferredKeys.indexOf(a.key)
    const bRank = preferredKeys.indexOf(b.key)
    return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank)
  })
  const samples = variables.filter((variable) => variable.type !== 'fixed').slice(0, 3).map((variable) => ({ label: variable.label, value: formatSample(variable, values[variable.key], scenario) }))
  return { title, story, detail, samples }
}
