import type { Scenario, SimulationResult } from '../simulation/scenarioTypes'
import { resultCounts } from './resultCounts'

export function resultCopy(scenario: Scenario, result: SimulationResult): { primary: string; secondary: string } {
  const counts = resultCounts(result)
  const leaderIndex = counts[0] >= counts[1] ? 0 : 1
  const leader = result.summary.options[leaderIndex]
  const other = result.summary.options[leaderIndex === 0 ? 1 : 0]
  const secondary = leader.upside < other.upside ? `${scenario.options[leaderIndex === 0 ? 1 : 0].name} has the larger upside, but a lower floor.` : `${scenario.options[leaderIndex].name} also holds the stronger modeled floor.`
  return {
    primary: `In ${counts[leaderIndex].toLocaleString('en-US')} of ${result.winners.length.toLocaleString('en-US')} simulated futures, ${scenario.options[leaderIndex].name.toLocaleLowerCase()} ends ahead.`,
    secondary,
  }
}
