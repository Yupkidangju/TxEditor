import { create } from 'zustand'
import type { Shape, ShapeId } from '../core/shapes'

export type ToolType = 'select' | 'box' | 'arrow' | 'line' | 'text'

export type Cursor = { x: number; y: number } | null

type HistoryEntry = {
  shapes: Shape[]
  selectedShapeId: ShapeId | null
}

export type EditorState = {
  activeTool: ToolType
  gridCellSize: number
  shapes: Shape[]
  selectedShapeId: ShapeId | null
  cursor: Cursor
  past: HistoryEntry[]
  future: HistoryEntry[]
  setActiveTool: (tool: ToolType) => void
  setGridCellSize: (size: number) => void
  addShape: (shape: Shape) => void
  updateShape: (id: ShapeId, updater: (prev: Shape) => Shape) => void
  removeShape: (id: ShapeId) => void
  setSelectedShapeId: (id: ShapeId | null) => void
  setCursor: (cursor: Cursor) => void
  undo: () => void
  redo: () => void
  duplicateSelected: () => void
}

function cloneShapes(shapes: Shape[]) {
  return shapes.map((s) => ({ ...s }))
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  gridCellSize: 16,
  shapes: [],
  selectedShapeId: null,
  cursor: null,
  past: [],
  future: [],
  setActiveTool: (tool) => set({ activeTool: tool }),
  setGridCellSize: (size) => set({ gridCellSize: Math.max(1, Math.floor(size)) }),
  addShape: (shape) =>
    set((s) => ({
      past: [...s.past, { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }],
      future: [],
      shapes: [...s.shapes, shape]
    })),
  updateShape: (id, updater) =>
    set((s) => ({
      past: [...s.past, { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }],
      future: [],
      shapes: s.shapes.map((shape) => (shape.id === id ? updater(shape) : shape))
    })),
  removeShape: (id) =>
    set((s) => ({
      past: [...s.past, { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }],
      future: [],
      shapes: s.shapes.filter((shape) => shape.id !== id),
      selectedShapeId: s.selectedShapeId === id ? null : s.selectedShapeId
    })),
  setSelectedShapeId: (id) => set({ selectedShapeId: id }),
  setCursor: (cursor) => set({ cursor }),
  undo: () =>
    set((s) => {
      const last = s.past[s.past.length - 1]
      if (!last) return s
      const current: HistoryEntry = { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }
      return {
        ...s,
        past: s.past.slice(0, -1),
        future: [current, ...s.future],
        shapes: cloneShapes(last.shapes),
        selectedShapeId: last.selectedShapeId
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      const current: HistoryEntry = { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }
      return {
        ...s,
        past: [...s.past, current],
        future: s.future.slice(1),
        shapes: cloneShapes(next.shapes),
        selectedShapeId: next.selectedShapeId
      }
    }),
  duplicateSelected: () =>
    set((s) => {
      const selectedId = s.selectedShapeId
      if (!selectedId) return s
      const shape = s.shapes.find((sh) => sh.id === selectedId)
      if (!shape) return s

      const delta = s.gridCellSize
      const nextId = `${shape.id}_copy_${Date.now().toString(16)}`
      const createdAt = Date.now()

      const duplicated: Shape =
        shape.type === 'box'
          ? { ...shape, id: nextId, createdAt, x: shape.x + delta, y: shape.y + delta }
          : shape.type === 'text'
            ? { ...shape, id: nextId, createdAt, x: shape.x + delta, y: shape.y + delta }
            : shape.type === 'line'
              ? { ...shape, id: nextId, createdAt, x1: shape.x1 + delta, y1: shape.y1 + delta, x2: shape.x2 + delta, y2: shape.y2 + delta }
              : { ...shape, id: nextId, createdAt, x1: shape.x1 + delta, y1: shape.y1 + delta, x2: shape.x2 + delta, y2: shape.y2 + delta }

      return {
        ...s,
        past: [...s.past, { shapes: cloneShapes(s.shapes), selectedShapeId: s.selectedShapeId }],
        future: [],
        shapes: [...s.shapes, duplicated],
        selectedShapeId: duplicated.id
      }
    })
}))
