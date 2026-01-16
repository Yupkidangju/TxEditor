import { create } from 'zustand'

export type ToolType = 'select' | 'box' | 'arrow' | 'line' | 'text'

export type EditorState = {
  activeTool: ToolType
  gridCellSize: number
  setActiveTool: (tool: ToolType) => void
  setGridCellSize: (size: number) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  gridCellSize: 16,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setGridCellSize: (size) => set({ gridCellSize: Math.max(1, Math.floor(size)) })
}))

