import { parseExpression } from './expressionParser'
import type { Scenario } from './scenarioTypes'

export interface ValidationIssue { path: string; message: string }

export function validateScenario(input: unknown): { scenario?: Scenario; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  if (!input || typeof input !== 'object') return { issues: [{ path: 'scenario', message: 'Scenario must be an object.' }] }
  const scenario = input as Scenario
  if (scenario.schemaVersion !== 1) issues.push({ path: 'schemaVersion', message: 'Only schema version 1 is supported.' })
  if (scenario.runs !== 10000) issues.push({ path: 'runs', message: 'V1 always runs exactly 10,000 futures.' })
  if (!Array.isArray(scenario.options) || scenario.options.length !== 2) issues.push({ path: 'options', message: 'A scenario must contain exactly two options.' })
  if (!Array.isArray(scenario.variables)) issues.push({ path: 'variables', message: 'Variables must be an array.' })
  const ids = new Set<string>()
  const keys = new Set<string>()
  for (const [index, variable] of (scenario.variables ?? []).entries()) {
    if (!variable.id || ids.has(variable.id)) issues.push({ path: `variables.${index}.id`, message: 'Variable ids must be present and unique.' })
    ids.add(variable.id)
    if (!variable.key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.key) || keys.has(variable.key)) issues.push({ path: `variables.${index}.key`, message: 'Expression keys must be unique and machine safe.' })
    keys.add(variable.key)
    const numbers = [variable.value, variable.mean, variable.standardDeviation, variable.low, variable.high, variable.mode, variable.probability, variable.minimum, variable.maximum].filter((value) => value !== undefined)
    if (numbers.some((value) => !Number.isFinite(value))) issues.push({ path: `variables.${index}`, message: 'Variable values must be finite.' })
    if (variable.type === 'normal' && (variable.standardDeviation ?? -1) < 0) issues.push({ path: `variables.${index}.standardDeviation`, message: 'Variation cannot be negative.' })
    if (variable.type === 'bernoulli' && ((variable.probability ?? -1) < 0 || (variable.probability ?? 2) > 1)) issues.push({ path: `variables.${index}.probability`, message: 'Chance must be from 0% to 100%.' })
    if ((variable.type === 'uniform' || variable.type === 'triangular') && (variable.low ?? 0) > (variable.high ?? 0)) issues.push({ path: `variables.${index}`, message: 'The lower bound cannot exceed the upper bound.' })
    if (variable.type === 'triangular' && ((variable.mode ?? 0) < (variable.low ?? 0) || (variable.mode ?? 0) > (variable.high ?? 0))) issues.push({ path: `variables.${index}.mode`, message: 'Most likely must sit between the bounds.' })
  }
  if (!Number.isFinite(scenario.target)) issues.push({ path: 'target', message: 'Target must be finite.' })
  if (!Number.isInteger(scenario.seed) || !Number.isInteger(scenario.visualSeed)) issues.push({ path: 'seed', message: 'Seeds must be integers.' })
  for (const [index, option] of (scenario.options ?? []).entries()) {
    try { parseExpression(option.formula, keys) } catch (error) { issues.push({ path: `options.${index}.formula`, message: `${option.name ?? `Option ${index + 1}`}: ${error instanceof Error ? error.message : 'Invalid formula.'}` }) }
  }
  return issues.length ? { issues } : { scenario: structuredClone(scenario), issues }
}
