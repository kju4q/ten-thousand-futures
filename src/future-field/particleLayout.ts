import { stableUniform } from '../simulation/deterministicRandom'
import type { SimulationResult } from '../simulation/scenarioTypes'

export interface ParticleLayout { x: Float32Array; y: Float32Array; clamped: Uint8Array }

export function createParticleLayout(result: SimulationResult, visualSeed: number): ParticleLayout {
  const count = result.margins.length
  const absoluteMargins = Float64Array.from(result.margins, Math.abs).sort()
  const robustScale = Math.max(1, absoluteMargins[Math.floor(count * 0.99)])
  const winningOutcomes = new Float64Array(count)
  for (let i = 0; i < count; i += 1) winningOutcomes[i] = Math.max(result.outcomesA[i], result.outcomesB[i])
  const ranked = Array.from({ length: count }, (_, index) => index).sort((a, b) => winningOutcomes[a] - winningOutcomes[b])
  const ranks = new Float32Array(count)
  for (let rank = 0; rank < count; rank += 1) ranks[ranked[rank]] = rank / Math.max(1, count - 1)
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const clamped = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    const linear = Math.max(-1, Math.min(1, result.margins[i] / robustScale))
    const normalized = Math.sign(linear) * Math.sqrt(Math.abs(linear))
    clamped[i] = Math.abs(result.margins[i]) > robustScale ? 1 : 0
    const jitterX = (stableUniform(visualSeed, 'layout-x', i, 0) - 0.5) * 0.03
    const jitterY = (stableUniform(visualSeed, 'layout-y', i, 0) - 0.5) * 0.035
    x[i] = Math.max(0.035, Math.min(0.965, 0.5 + normalized * 0.43 + jitterX))
    y[i] = Math.max(0.055, Math.min(0.945, 0.94 - ranks[i] * 0.88 + jitterY))
  }
  return { x, y, clamped }
}
