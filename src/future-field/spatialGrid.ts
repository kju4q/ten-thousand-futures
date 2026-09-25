export interface SpatialHit {
  id: number
  distance: number
  candidates: number
}

export interface SpatialNeighbor {
  id: number
  distance: number
}

export class ParticleSpatialGrid {
  readonly columns: number
  readonly rows: number
  private readonly buckets: number[][]
  private readonly x: Float32Array
  private readonly y: Float32Array

  constructor(x: Float32Array, y: Float32Array, columns = 96, rows = 64) {
    this.x = x
    this.y = y
    this.columns = columns
    this.rows = rows
    this.buckets = Array.from({ length: columns * rows }, () => [])
    for (let id = 0; id < x.length; id += 1) {
      const column = Math.max(0, Math.min(columns - 1, Math.floor(x[id] * columns)))
      const row = Math.max(0, Math.min(rows - 1, Math.floor(y[id] * rows)))
      this.buckets[row * columns + column].push(id)
    }
  }

  nearest(normalizedX: number, normalizedY: number, radiusX: number, radiusY: number): SpatialHit | null {
    const firstColumn = Math.max(0, Math.floor((normalizedX - radiusX) * this.columns))
    const lastColumn = Math.min(this.columns - 1, Math.floor((normalizedX + radiusX) * this.columns))
    const firstRow = Math.max(0, Math.floor((normalizedY - radiusY) * this.rows))
    const lastRow = Math.min(this.rows - 1, Math.floor((normalizedY + radiusY) * this.rows))
    let nearestId = -1
    let nearestDistance = 1
    let candidates = 0
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const bucket = this.buckets[row * this.columns + column]
        candidates += bucket.length
        for (const id of bucket) {
          const deltaX = (this.x[id] - normalizedX) / Math.max(Number.EPSILON, radiusX)
          const deltaY = (this.y[id] - normalizedY) / Math.max(Number.EPSILON, radiusY)
          const distance = deltaX * deltaX + deltaY * deltaY
          if (distance <= 1 && distance < nearestDistance) {
            nearestId = id
            nearestDistance = distance
          }
        }
      }
    }
    return nearestId < 0 ? null : { id: nearestId, distance: nearestDistance, candidates }
  }

  within(normalizedX: number, normalizedY: number, radiusX: number, radiusY: number, limit = 180): SpatialNeighbor[] {
    const firstColumn = Math.max(0, Math.floor((normalizedX - radiusX) * this.columns))
    const lastColumn = Math.min(this.columns - 1, Math.floor((normalizedX + radiusX) * this.columns))
    const firstRow = Math.max(0, Math.floor((normalizedY - radiusY) * this.rows))
    const lastRow = Math.min(this.rows - 1, Math.floor((normalizedY + radiusY) * this.rows))
    const neighbors: SpatialNeighbor[] = []
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        for (const id of this.buckets[row * this.columns + column]) {
          const deltaX = (this.x[id] - normalizedX) / Math.max(Number.EPSILON, radiusX)
          const deltaY = (this.y[id] - normalizedY) / Math.max(Number.EPSILON, radiusY)
          const distance = deltaX * deltaX + deltaY * deltaY
          if (distance <= 1) neighbors.push({ id, distance })
        }
      }
    }
    neighbors.sort((first, second) => first.distance - second.distance)
    return neighbors.slice(0, limit)
  }
}
