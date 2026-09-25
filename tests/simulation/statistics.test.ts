import { describe, expect, it } from 'vitest'
import { calculateStatistics, quantile } from '../../src/simulation/statistics'

describe('statistics', () => {
  it('calculates interpolated percentiles and goal-aware range meaning', () => {
    const values = Float64Array.from({ length: 100 }, (_, index) => index + 1)
    expect(quantile(values, 0.05)).toBeCloseTo(5.95)
    const maximum = calculateStatistics(values, 50, 2, 90, 'max')
    expect(maximum.p10).toBeCloseTo(10.9)
    expect(maximum.median).toBeCloseTo(50.5)
    expect(maximum.p90).toBeCloseTo(90.1)
    expect(maximum.targetClearingRate).toBeCloseTo(0.11)
    expect(maximum.downside).toBe(maximum.p05)
    const minimum = calculateStatistics(values, 50, 2, 10, 'min')
    expect(minimum.downside).toBe(minimum.p95)
    expect(minimum.upside).toBe(minimum.p05)
  })
})
