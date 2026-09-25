import { sampleVariable } from './distributions'
import { evaluateExpression } from './expressionEvaluator'
import { parseExpression } from './expressionParser'
import { validateScenario } from './scenarioValidation'
import type { Scenario, SimulationResult } from './scenarioTypes'
import { calculateStatistics } from './statistics'

export const ENGINE_VERSION = '1.0.0'

export function simulateScenario(input: Scenario): SimulationResult {
  const validation = validateScenario(input)
  if (!validation.scenario) throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  const scenario = validation.scenario
  const keys = new Set(scenario.variables.map((variable) => variable.key))
  const formulaA = parseExpression(scenario.options[0].formula, keys)
  const formulaB = parseExpression(scenario.options[1].formula, keys)
  const outcomesA = new Float64Array(scenario.runs)
  const outcomesB = new Float64Array(scenario.runs)
  const margins = new Float64Array(scenario.runs)
  const winners = new Uint8Array(scenario.runs)
  const futureIds = new Uint16Array(scenario.runs)
  let winsA = 0
  let winsB = 0
  let ties = 0
  const started = performance.now()
  const values: Record<string, number> = Object.create(null) as Record<string, number>
  for (let futureId = 0; futureId < scenario.runs; futureId += 1) {
    for (const variable of scenario.variables) values[variable.key] = sampleVariable(variable, scenario.seed, futureId)
    const a = evaluateExpression(formulaA, values)
    const b = evaluateExpression(formulaB, values)
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`Future ${futureId} produced a non-finite result.`)
    outcomesA[futureId] = a
    outcomesB[futureId] = b
    margins[futureId] = b - a
    futureIds[futureId] = futureId
    const tolerance = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
    if (Math.abs(a - b) <= tolerance) { winners[futureId] = 2; ties += 1 }
    else if ((scenario.goal === 'max' && a > b) || (scenario.goal === 'min' && a < b)) { winners[futureId] = 0; winsA += 1 }
    else { winners[futureId] = 1; winsB += 1 }
  }
  return {
    engineVersion: ENGINE_VERSION,
    scenarioId: scenario.id,
    summary: {
      options: [calculateStatistics(outcomesA, winsA, ties, scenario.target, scenario.goal), calculateStatistics(outcomesB, winsB, ties, scenario.target, scenario.goal)],
      ties,
      winner: winsA === winsB ? 2 : winsA > winsB ? 0 : 1,
      durationMs: performance.now() - started,
    },
    outcomesA, outcomesB, margins, winners, futureIds,
  }
}
