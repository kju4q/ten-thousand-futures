import type { Goal, OptionStatistics } from './scenarioTypes'

export function quantile(sorted: Float64Array | number[], probability: number): number {
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const remainder = position - lower
  return sorted[lower] + ((sorted[lower + 1] ?? sorted[lower]) - sorted[lower]) * remainder
}

export function calculateStatistics(outcomes: Float64Array, wins: number, ties: number, target: number, goal: Goal): OptionStatistics {
  const sorted = Float64Array.from(outcomes).sort()
  let sum = 0
  let clears = 0
  for (const value of outcomes) { sum += value; if (goal === 'max' ? value >= target : value <= target) clears += 1 }
  const p05 = quantile(sorted, 0.05)
  const p95 = quantile(sorted, 0.95)
  return {
    mean: sum / outcomes.length,
    median: quantile(sorted, 0.5),
    p05,
    p10: quantile(sorted, 0.1),
    p90: quantile(sorted, 0.9),
    p95,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    winRate: wins / outcomes.length,
    tieRate: ties / outcomes.length,
    targetClearingRate: clears / outcomes.length,
    downside: goal === 'max' ? p05 : p95,
    upside: goal === 'max' ? p95 : p05,
  }
}
