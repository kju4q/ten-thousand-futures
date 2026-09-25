import { describe, expect, it } from 'vitest'
import { createFutureStory, sampleFutureVariables } from '../../src/future-field/futureStory'
import { freshDefaultScenario } from '../../src/scenarios/defaultScenario'
import { simulateScenario } from '../../src/simulation/simulationEngine'

describe('future stories', () => {
  it('uses the same stable per-future samples as the engine', () => {
    const scenario = freshDefaultScenario()
    const result = simulateScenario(scenario)
    const futureId = 4381
    const values = sampleFutureVariables(scenario, futureId)
    expect(result.outcomesA[futureId]).toBeCloseTo((values.salary_a + values.bonus_a) * values.years)
    expect(result.outcomesB[futureId]).toBeCloseTo(values.salary_b * values.years + values.equity_b * values.startup_succeeds)
    const story = createFutureStory(scenario, result, futureId)
    expect(story.title).toBe('future no. 4,382 of 10,000')
    expect(story.story).toContain('in this simulated run')
    expect(story.detail).toMatch(/sampled (yes|no)/)
  })

  it('keeps a future story stable for identical seeds', () => {
    const scenario = freshDefaultScenario()
    expect(createFutureStory(scenario, simulateScenario(scenario), 742)).toEqual(createFutureStory(scenario, simulateScenario(scenario), 742))
  })
})
