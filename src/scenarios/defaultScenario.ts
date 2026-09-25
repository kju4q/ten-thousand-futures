import type { Scenario } from '../simulation/scenarioTypes'

export const DEFAULT_SCENARIO: Scenario = {
  schemaVersion: 1,
  id: 'stable-role-or-startup-bet',
  title: 'Stable Role or Startup Bet?',
  question: 'Which path gives me the stronger three-year outcome?',
  description: 'A fictional comparison of stable compensation and startup upside over three years.',
  locale: 'en-US',
  outcomeLabel: 'Three-year value',
  goal: 'max',
  outputFormat: 'currency',
  currency: 'USD',
  runs: 10000,
  seed: 42,
  visualSeed: 42,
  target: 550000,
  variables: [
    { id: 'years-v1', key: 'years', label: 'Time horizon', type: 'fixed', value: 3, minimum: 1, maximum: 10, display: { group: 'shared', unit: 'years', step: 1 } },
    { id: 'salary-a-v1', key: 'salary_a', label: 'Annual salary', type: 'fixed', value: 165000, minimum: 0, maximum: 500000, display: { group: 'a', unit: 'currency', step: 5000 } },
    { id: 'bonus-a-v1', key: 'bonus_a', label: 'Annual bonus', type: 'normal', mean: 20000, standardDeviation: 6000, minimum: 0, maximum: 80000, display: { group: 'a', unit: 'currency', step: 1000 } },
    { id: 'salary-b-v1', key: 'salary_b', label: 'Annual salary', type: 'fixed', value: 140000, minimum: 0, maximum: 500000, display: { group: 'b', unit: 'currency', step: 5000 } },
    { id: 'equity-b-v1', key: 'equity_b', label: 'Equity outcome', type: 'triangular', low: 0, high: 900000, mode: 120000, minimum: 0, maximum: 1200000, display: { group: 'b', unit: 'currency', step: 10000 } },
    { id: 'success-b-v1', key: 'startup_succeeds', label: 'Startup succeeds', type: 'bernoulli', probability: 0.35, minimum: 0, maximum: 1, display: { group: 'b', unit: 'percent', step: 0.01, prominent: true } },
  ],
  options: [
    { id: 'a', name: 'Stable Role', formula: '(salary_a + bonus_a) * years' },
    { id: 'b', name: 'Startup Bet', formula: 'salary_b * years + equity_b * startup_succeeds' },
  ],
}

export function freshDefaultScenario(): Scenario {
  return structuredClone(DEFAULT_SCENARIO)
}
