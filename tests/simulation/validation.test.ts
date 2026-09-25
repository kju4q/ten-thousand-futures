import { describe, expect, it } from 'vitest'
import { freshDefaultScenario } from '../../src/scenarios/defaultScenario'
import { parseExpression } from '../../src/simulation/expressionParser'
import { validateScenario } from '../../src/simulation/scenarioValidation'
import { simulateScenario } from '../../src/simulation/simulationEngine'
import { isStaleResponse } from '../../src/simulation/workerProtocol'

describe('scenario validation and expressions', () => {
  it.each([
    ['invalid probability', (scenario: ReturnType<typeof freshDefaultScenario>) => { scenario.variables[5].probability = 2 }],
    ['invalid standard deviation', (scenario: ReturnType<typeof freshDefaultScenario>) => { scenario.variables[2].standardDeviation = -1 }],
    ['invalid triangular bounds', (scenario: ReturnType<typeof freshDefaultScenario>) => { scenario.variables[4].mode = 9999999 }],
    ['duplicate variable id', (scenario: ReturnType<typeof freshDefaultScenario>) => { scenario.variables[1].id = scenario.variables[0].id }],
    ['unsupported schema version', (scenario: ReturnType<typeof freshDefaultScenario>) => { Object.assign(scenario, { schemaVersion: 2 }) }],
    ['wrong option count', (scenario: ReturnType<typeof freshDefaultScenario>) => { Object.assign(scenario, { options: [scenario.options[0]] }) }],
  ])('rejects %s', (_, mutate) => {
    const scenario = freshDefaultScenario()
    mutate(scenario)
    expect(validateScenario(scenario).issues.length).toBeGreaterThan(0)
  })

  it('rejects missing variables, unknown functions, and unsafe expressions', () => {
    expect(() => parseExpression('missing + 1', new Set(['known']))).toThrow('Unknown variable')
    expect(() => parseExpression('fetch(known)', new Set(['known']))).toThrow('Unknown function')
    expect(() => parseExpression('window.location', new Set(['known']))).toThrow('Unknown variable')
  })

  it('rejects non-finite formula results', () => {
    const scenario = freshDefaultScenario()
    scenario.options[0].formula = '1 / 0'
    expect(() => simulateScenario(scenario)).toThrow('non-finite')
  })

  it('produces strict JSON without invalid numeric values', () => {
    const json = JSON.stringify(simulateScenario(freshDefaultScenario()).summary)
    expect(json).not.toMatch(/NaN|Infinity/)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('ignores stale worker responses', () => {
    expect(isStaleResponse(3, 4)).toBe(true)
    expect(isStaleResponse(4, 4)).toBe(false)
  })
})
