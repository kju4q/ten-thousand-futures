import { describe, expect, it } from 'vitest'
import { freshDefaultScenario } from '../../src/scenarios/defaultScenario'
import { simulateScenario } from '../../src/simulation/simulationEngine'
import { resultCopy } from '../../src/utils/resultCopy'
import { resultCounts, samplingErrorFutures } from '../../src/utils/resultCounts'

describe('observatory result counts', () => {
  it('derives exact ledger counts from the paired futures', () => {
    const scenario = freshDefaultScenario()
    const result = simulateScenario(scenario)
    const counts = resultCounts(result)
    expect(counts[0] + counts[1] + counts[2]).toBe(10_000)
    expect(resultCopy(scenario, result).primary).toMatch(/^In [\d,]+ of 10,000 simulated futures, .+ ends ahead\.$/)
    expect(samplingErrorFutures(result)).toBe(100)
  })
})
