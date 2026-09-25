import type { SimulationResult } from '../simulation/scenarioTypes'

export type ResultCounts = [number, number, number]

export function resultCounts(result: SimulationResult): ResultCounts {
  const counts: ResultCounts = [0, 0, 0]
  for (const winner of result.winners) counts[winner] += 1
  return counts
}

export function samplingErrorFutures(result: SimulationResult): number {
  const counts = resultCounts(result)
  const runs = result.winners.length
  const leadingShare = Math.max(counts[0], counts[1]) / runs
  const ninetyFivePercentMargin = 1.96 * Math.sqrt(runs * leadingShare * (1 - leadingShare))
  return Math.max(50, Math.round(ninetyFivePercentMargin / 50) * 50)
}
