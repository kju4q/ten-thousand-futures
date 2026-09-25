import type { ScenarioVariable } from './scenarioTypes'
import { stableNormal, stableUniform } from './deterministicRandom'

const clamp = (value: number, minimum?: number, maximum?: number) => Math.min(maximum ?? Infinity, Math.max(minimum ?? -Infinity, value))

export function sampleVariable(variable: ScenarioVariable, seed: number, futureId: number): number {
  let value: number
  switch (variable.type) {
    case 'fixed': value = variable.value ?? 0; break
    case 'normal': value = (variable.mean ?? 0) + (variable.standardDeviation ?? 0) * stableNormal(seed, variable.id, futureId); break
    case 'uniform': {
      const u = stableUniform(seed, variable.id, futureId, 0)
      value = (variable.low ?? 0) + u * ((variable.high ?? 0) - (variable.low ?? 0)); break
    }
    case 'triangular': {
      const low = variable.low ?? 0
      const high = variable.high ?? 0
      const mode = variable.mode ?? low
      const u = stableUniform(seed, variable.id, futureId, 0)
      const split = (mode - low) / (high - low)
      value = u < split ? low + Math.sqrt(u * (high - low) * (mode - low)) : high - Math.sqrt((1 - u) * (high - low) * (high - mode)); break
    }
    case 'bernoulli': value = stableUniform(seed, variable.id, futureId, 0) < (variable.probability ?? 0) ? 1 : 0; break
  }
  return clamp(value, variable.minimum, variable.maximum)
}
