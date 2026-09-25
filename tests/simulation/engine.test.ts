import { describe, expect, it } from 'vitest'
import { createParticleLayout } from '../../src/future-field/particleLayout'
import { freshDefaultScenario } from '../../src/scenarios/defaultScenario'
import { sampleVariable } from '../../src/simulation/distributions'
import { simulateScenario } from '../../src/simulation/simulationEngine'
import type { Scenario, ScenarioVariable } from '../../src/simulation/scenarioTypes'

function fixedScenario(goal: 'max' | 'min' = 'max'): Scenario {
  const scenario = freshDefaultScenario()
  scenario.goal = goal
  scenario.variables = [
    { id: 'left', key: 'left', label: 'Left', type: 'fixed', value: 10, display: { group: 'a', unit: 'years', step: 1 } },
    { id: 'right', key: 'right', label: 'Right', type: 'fixed', value: 20, display: { group: 'b', unit: 'years', step: 1 } },
  ]
  scenario.options = [{ id: 'a', name: 'Left', formula: 'left' }, { id: 'b', name: 'Right', formula: 'right' }]
  scenario.target = 15
  return scenario
}

describe('simulation engine', () => {
  it('is identical for the same scenario and seeds', () => {
    const scenario = freshDefaultScenario()
    const first = simulateScenario(scenario)
    const second = simulateScenario(scenario)
    expect(first.outcomesA).toEqual(second.outcomesA)
    expect(first.outcomesB).toEqual(second.outcomesB)
    expect(createParticleLayout(first, scenario.visualSeed)).toEqual(createParticleLayout(second, scenario.visualSeed))
  })

  it('restores exact demo results and particle layout', () => {
    const firstScenario = freshDefaultScenario()
    firstScenario.variables[5].probability = 0.65
    simulateScenario(firstScenario)
    const resetA = freshDefaultScenario()
    const resetB = freshDefaultScenario()
    const resultA = simulateScenario(resetA)
    const resultB = simulateScenario(resetB)
    expect(resultA.margins).toEqual(resultB.margins)
    expect(createParticleLayout(resultA, resetA.visualSeed)).toEqual(createParticleLayout(resultB, resetB.visualSeed))
  })

  it('handles exact fixed outcomes, goals, target clearing, and percentiles', () => {
    const maxResult = simulateScenario(fixedScenario())
    expect(maxResult.outcomesA[0]).toBe(10)
    expect(maxResult.summary.options[1].winRate).toBe(1)
    expect(maxResult.summary.options[1].targetClearingRate).toBe(1)
    expect(maxResult.summary.options[0]).toMatchObject({ p05: 10, p10: 10, median: 10, p90: 10, p95: 10 })
    expect(simulateScenario(fixedScenario('min')).summary.options[0].winRate).toBe(1)
  })

  it('counts ties fairly with relative numeric tolerance', () => {
    const scenario = fixedScenario()
    scenario.variables[1].value = 10 + 1e-10
    const result = simulateScenario(scenario)
    expect(result.summary.ties).toBe(10000)
    expect(result.summary.options[0].tieRate).toBe(1)
    expect(result.summary.options[0].winRate).toBe(0)
  })

  it('samples every supported distribution deterministically with clamps', () => {
    const base = { id: 'sample', key: 'sample', label: 'Sample', display: { group: 'shared' as const, unit: 'years' as const, step: 1 } }
    const variables: ScenarioVariable[] = [
      { ...base, type: 'normal', mean: 5, standardDeviation: 2, minimum: 4, maximum: 6 },
      { ...base, type: 'uniform', low: 2, high: 8 },
      { ...base, type: 'triangular', low: 0, high: 10, mode: 3 },
      { ...base, type: 'bernoulli', probability: 0.4 },
    ]
    const values = variables.map((variable) => sampleVariable(variable, 42, 10))
    expect(values[0]).toBeGreaterThanOrEqual(4)
    expect(values[0]).toBeLessThanOrEqual(6)
    expect(values[1]).toBeGreaterThanOrEqual(2)
    expect(values[1]).toBeLessThanOrEqual(8)
    expect(values[2]).toBeGreaterThanOrEqual(0)
    expect(values[2]).toBeLessThanOrEqual(10)
    expect([0, 1]).toContain(values[3])
    expect(values).toEqual(variables.map((variable) => sampleVariable(variable, 42, 10)))
  })

  it('keeps streams stable after reordering and label changes', () => {
    const original = freshDefaultScenario()
    const changed = freshDefaultScenario()
    changed.variables.reverse()
    changed.variables[0].label = 'Renamed visible label'
    expect(simulateScenario(original).outcomesA).toEqual(simulateScenario(changed).outcomesA)
  })

  it('reuses unrelated quantiles when one assumption changes', () => {
    const original = freshDefaultScenario()
    const changed = freshDefaultScenario()
    changed.variables.find((variable) => variable.key === 'startup_succeeds')!.probability = 0.65
    expect(simulateScenario(original).outcomesA).toEqual(simulateScenario(changed).outcomesA)
  })

  it('flips the demo leader when startup success rises', () => {
    const defaultResult = simulateScenario(freshDefaultScenario())
    const changed = freshDefaultScenario()
    changed.variables.find((variable) => variable.key === 'startup_succeeds')!.probability = 0.65
    const changedResult = simulateScenario(changed)
    expect(defaultResult.summary.options[0].winRate).toBeGreaterThan(0.5)
    expect(changedResult.summary.options[1].winRate).toBeGreaterThan(0.5)
  })

  it('spreads final particle layout across both axes', () => {
    const scenario = freshDefaultScenario()
    const layout = createParticleLayout(simulateScenario(scenario), scenario.visualSeed)
    expect(Math.min(...layout.x)).toBeLessThan(0.25)
    expect(Math.max(...layout.x)).toBeGreaterThan(0.75)
    expect(Math.min(...layout.y)).toBeLessThan(0.1)
    expect(Math.max(...layout.y)).toBeGreaterThan(0.9)
  })
})
