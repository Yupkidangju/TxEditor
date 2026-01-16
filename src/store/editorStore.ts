import { create } from 'zustand'
import type { Shape, ShapeId } from '../core/shapes'

export type ToolType = 'select' | 'box' | 'arrow' | 'line' | 'text'

export type Cursor = { x: number; y: number } | null

export type EditorState = {
  activeTool: ToolType
  gridCellSize: number
  shapes: Shape[]
  selectedShapeId: ShapeId | null
  cursor: Cursor
  setActiveTool: (tool: ToolType) => void
  setGridCellSize: (size: number) => void
  addShape: (shape: Shape) => void
  updateShape: (id: ShapeId, updater: (prev: Shape) => Shape) => void
  removeShape: (id: ShapeId) => void
  setSelectedShapeId: (id: ShapeId | null) => void
  setCursor: (cursor: Cursor) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  gridCellSize: 16,
  shapes: [],
  selectedShapeId: null,
  cursor: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setGridCellSize: (size) => set({ gridCellSize: Math.max(1, Math.floor(size)) }),
  addShape: (shape) => set((s) => ({ shapes: [...s.shapes, shape] })),
  updateShape: (id, updater) =>
    set((s) => ({
      shapes: s.shapes.map((shape) => (shape.id === id ? updater(shape) : shape))
    })),
  removeShape: (id) =>
    set((s) => ({
      shapes: s.shapes.filter((shape) => shape.id !== id),
      selectedShapeId: s.selectedShapeId === id ? null : s.selectedShapeId
    })),
  setSelectedShapeId: (id) => set({ selectedShapeId: id }),
  setCursor: (cursor) => set({ cursor })
}))
