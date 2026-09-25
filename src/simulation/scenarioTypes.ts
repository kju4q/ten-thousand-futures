export type Goal = 'max' | 'min'
export type VariableType = 'fixed' | 'normal' | 'uniform' | 'triangular' | 'bernoulli'

export interface VariableDisplay { group: 'shared' | 'a' | 'b'; unit: 'currency' | 'percent' | 'years'; step: number; prominent?: boolean }
export interface ScenarioVariable {
  id: string
  key: string
  label: string
  type: VariableType
  value?: number
  mean?: number
  standardDeviation?: number
  low?: number
  high?: number
  mode?: number
  probability?: number
  minimum?: number
  maximum?: number
  display: VariableDisplay
}
export interface ScenarioOption { id: 'a' | 'b'; name: string; formula: string }
export interface Scenario {
  schemaVersion: 1
  id: string
  title: string
  question: string
  description: string
  locale: string
  outcomeLabel: string
  goal: Goal
  outputFormat: 'currency' | 'number'
  currency: string
  runs: 10000
  seed: number
  visualSeed: number
  target: number
  variables: ScenarioVariable[]
  options: [ScenarioOption, ScenarioOption]
}

export interface OptionStatistics {
  mean: number
  median: number
  p05: number
  p10: number
  p90: number
  p95: number
  minimum: number
  maximum: number
  winRate: number
  tieRate: number
  targetClearingRate: number
  downside: number
  upside: number
}

export interface SimulationSummary {
  options: [OptionStatistics, OptionStatistics]
  ties: number
  winner: 0 | 1 | 2
  durationMs: number
}

export interface SimulationResult {
  engineVersion: string
  scenarioId: string
  summary: SimulationSummary
  outcomesA: Float64Array
  outcomesB: Float64Array
  margins: Float64Array
  winners: Uint8Array
  futureIds: Uint16Array
}
