import { describe, expect, it } from 'vitest'
import { createParticleLayout } from '../../src/future-field/particleLayout'
import { ParticleSpatialGrid } from '../../src/future-field/spatialGrid'
import { freshDefaultScenario } from '../../src/scenarios/defaultScenario'
import { simulateScenario } from '../../src/simulation/simulationEngine'

describe('particle spatial grid', () => {
  it('finds an exact particle without scanning the full field', () => {
    const scenario = freshDefaultScenario()
    const layout = createParticleLayout(simulateScenario(scenario), scenario.visualSeed)
    const grid = new ParticleSpatialGrid(layout.x, layout.y)
    const id = 4381
    const hit = grid.nearest(layout.x[id], layout.y[id], 12 / 1440, 12 / 900)
    expect(hit?.id).toBe(id)
    expect(hit?.candidates).toBeLessThan(1000)
  })

  it('returns null when no particle is within the touch radius', () => {
    const x = new Float32Array([0.1, 0.9])
    const y = new Float32Array([0.1, 0.9])
    expect(new ParticleSpatialGrid(x, y, 10, 10).nearest(0.5, 0.5, 0.02, 0.02)).toBeNull()
  })

  it('returns only nearby neighbors for firefly response', () => {
    const x = new Float32Array([0.49, 0.5, 0.51, 0.9])
    const y = new Float32Array([0.5, 0.5, 0.5, 0.9])
    const neighbors = new ParticleSpatialGrid(x, y, 10, 10).within(0.5, 0.5, 0.03, 0.03, 2)
    expect(neighbors.map(({ id }) => id)).toEqual([1, 0])
  })
})
