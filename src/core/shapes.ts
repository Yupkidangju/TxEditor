export type ShapeId = string

export type BaseShape = {
  id: ShapeId
  createdAt: number
}

export type BoxShape = BaseShape & {
  type: 'box'
  x: number
  y: number
  width: number
  height: number
}

export type LineShape = BaseShape & {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ArrowShape = BaseShape & {
  type: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type TextShape = BaseShape & {
  type: 'text'
  x: number
  y: number
  text: string
}

export type Shape = BoxShape | LineShape | ArrowShape | TextShape

export function createId(): ShapeId {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (randomUUID) return randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function normalizeBox(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(a.x - b.x)
  const height = Math.abs(a.y - b.y)
  return { x, y, width, height }
}

