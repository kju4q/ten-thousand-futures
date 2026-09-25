function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mix32(value: number): number {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

export function stableUniform(seed: number, variableId: string, futureId: number, slot: number): number {
  const combined = mix32(seed ^ hashString(variableId) ^ Math.imul(futureId + 1, 0x9e3779b1) ^ Math.imul(slot + 1, 0x85ebca6b))
  return (combined + 0.5) / 4294967296
}

export function stableNormal(seed: number, variableId: string, futureId: number): number {
  const u1 = Math.max(Number.EPSILON, stableUniform(seed, variableId, futureId, 0))
  const u2 = stableUniform(seed, variableId, futureId, 1)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
