export type GridPoint = { x: number; y: number }

export function snapToGrid(point: GridPoint, cellSize: number): GridPoint {
  if (cellSize <= 0) return point
  return {
    x: Math.round(point.x / cellSize) * cellSize,
    y: Math.round(point.y / cellSize) * cellSize
  }
}

