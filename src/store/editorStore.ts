import { create } from 'zustand'

import { cellLength, padCells, sliceCells, toDisplayText, type TextBuffer, type Layer } from '../core/cells'

export type Cursor = { row: number; col: number } | null

type HistoryEntry = { layers: Layer[]; activeLayerId: string; width: number; height: number }

export type EditorState = {
  width: number
  height: number
  layers: Layer[]
  activeLayerId: string
  cursor: Cursor
  past: HistoryEntry[]
  future: HistoryEntry[]
  
  // Getters (computed-like access helpers are not directly in state interface usually, but we expose state)
  getBuffer: () => TextBuffer
  
  // Actions
  setCursor: (cursor: Cursor) => void
  newBuffer: (width: number, height: number) => void
  setBufferFromText: (text: string) => void
  loadBufferFromTextAutoSize: (text: string) => void
  commitBuffer: (next: TextBuffer) => void
  
  // Layer Actions
  addLayer: () => void
  removeLayer: (id: string) => void
  selectLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  setLayerName: (id: string, name: string) => void
  
  undo: () => void
  redo: () => void
}

export const selectActiveBuffer = (state: EditorState) => {
  const layer = state.layers.find((l) => l.id === state.activeLayerId)
  return layer ? layer.buffer : state.layers[0].buffer
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

function createEmptyBuffer(width: number, height: number): TextBuffer {
  return { width, height, lines: Array.from({ length: height }, () => '') }
}

function createLayer(id: string, name: string, buffer: TextBuffer): Layer {
  return { id, name, visible: true, locked: false, buffer }
}

function normalizeTextToBuffer(text: string, width: number, height: number): TextBuffer {
  const normalized = text.replace(/\r\n/g, '\n')
  const rawLines = normalized.split('\n')

  const lines: string[] = []
  for (let i = 0; i < height; i += 1) {
    const src = rawLines[i] ?? ''
    lines.push(sliceCells(src, width))
  }

  return { width, height, lines }
}

export function bufferToText(buffer: TextBuffer, opts?: { padRight?: boolean }) {
  const padRight = opts?.padRight ?? false
  const out: string[] = []
  for (let i = 0; i < buffer.height; i += 1) {
    const internalLine = buffer.lines[i] ?? ''
    const padded = padRight ? padCells(internalLine, buffer.width) : internalLine
    out.push(toDisplayText(padded))
  }
  return out.join('\n')
}

// Deep clone for history
function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map(l => ({
    ...l,
    buffer: { ...l.buffer, lines: [...l.buffer.lines] }
  }))
}

function historyLimitForSize(width: number, height: number) {
  const cells = width * height
  if (cells <= 100 * 100) return 200
  if (cells <= 300 * 300) return 100
  if (cells <= 1000 * 1000) return 50
  return 20
}

function appendPast(past: HistoryEntry[], current: { layers: Layer[]; activeLayerId: string; width: number; height: number }, limit: number) {
  const entry: HistoryEntry = {
    layers: cloneLayers(current.layers),
    activeLayerId: current.activeLayerId,
    width: current.width,
    height: current.height
  }
  const next = [...past, entry]
  if (next.length <= limit) return next
  return next.slice(next.length - limit)
}

function prependFuture(future: HistoryEntry[], current: { layers: Layer[]; activeLayerId: string; width: number; height: number }, limit: number) {
  const entry: HistoryEntry = {
    layers: cloneLayers(current.layers),
    activeLayerId: current.activeLayerId,
    width: current.width,
    height: current.height
  }
  const next = [entry, ...future]
  if (next.length <= limit) return next
  return next.slice(0, limit)
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initialWidth = 80
  const initialHeight = 24
  const initialBuffer = createEmptyBuffer(initialWidth, initialHeight)
  const initialLayer = createLayer('layer-1', 'Background', initialBuffer)

  return {
    width: initialWidth,
    height: initialHeight,
    layers: [initialLayer],
    activeLayerId: 'layer-1',
    cursor: null,
    past: [],
    future: [],
    
    getBuffer: () => {
      const s = get()
      const layer = s.layers.find(l => l.id === s.activeLayerId)
      return layer ? layer.buffer : s.layers[0].buffer
    },

    setCursor: (cursor) => set({ cursor }),

    newBuffer: (width, height) => {
      const w = clampInt(width, 1, 2000)
      const h = clampInt(height, 1, 2000)
      const newBuffer = createEmptyBuffer(w, h)
      const newLayer = createLayer('layer-1', 'Background', newBuffer)
      
      set((s) => {
        const limit = historyLimitForSize(w, h)
        return {
          width: w,
          height: h,
          layers: [newLayer],
          activeLayerId: 'layer-1',
          past: appendPast(s.past, s, limit),
          future: [],
          cursor: null
        }
      })
    },

    setBufferFromText: (text) => {
      const { width, height, layers, activeLayerId } = get()
      const activeLayer = layers.find(l => l.id === activeLayerId)
      if (activeLayer?.locked) return

      const nextBuffer = normalizeTextToBuffer(text, width, height)
      
      set((s) => {
        const nextLayers = s.layers.map(l => l.id === activeLayerId ? { ...l, buffer: nextBuffer } : l)
        const limit = historyLimitForSize(width, height)
        return {
          layers: nextLayers,
          past: appendPast(s.past, s, limit),
          future: []
        }
      })
    },

    loadBufferFromTextAutoSize: (text) => {
      const normalized = text.replace(/\r\n/g, '\n')
      const rawLines = normalized.split('\n')
      const height = clampInt(rawLines.length || 1, 1, 2000)
      const width = clampInt(rawLines.reduce((m, line) => Math.max(m, cellLength(line)), 0) || 1, 1, 2000)
      const nextBuffer = normalizeTextToBuffer(normalized, width, height)
      const newLayer = createLayer('layer-1', 'Background', nextBuffer)

      set((s) => {
        const limit = historyLimitForSize(width, height)
        return {
          width,
          height,
          layers: [newLayer],
          activeLayerId: 'layer-1',
          past: appendPast(s.past, s, limit),
          future: [],
          cursor: null
        }
      })
    },

    commitBuffer: (nextBuffer) => {
      const { layers, activeLayerId } = get()
      const activeLayer = layers.find(l => l.id === activeLayerId)
      if (activeLayer?.locked) return

      set((s) => {
        const nextLayers = s.layers.map(l => l.id === s.activeLayerId ? { ...l, buffer: nextBuffer } : l)
        const limit = historyLimitForSize(s.width, s.height)
        return {
          layers: nextLayers,
          past: appendPast(s.past, s, limit),
          future: [],
          cursor: null
        }
      })
    },

    addLayer: () => {
      set((s) => {
        const newId = `layer-${Date.now()}`
        const newLayer = createLayer(newId, `Layer ${s.layers.length + 1}`, createEmptyBuffer(s.width, s.height))
        const limit = historyLimitForSize(s.width, s.height)
        return {
          layers: [...s.layers, newLayer],
          activeLayerId: newId,
          past: appendPast(s.past, s, limit),
          future: []
        }
      })
    },

    removeLayer: (id) => {
      set((s) => {
        if (s.layers.length <= 1) return s // Prevent removing last layer
        const nextLayers = s.layers.filter(l => l.id !== id)
        const nextActiveId = s.activeLayerId === id ? nextLayers[nextLayers.length - 1].id : s.activeLayerId
        const limit = historyLimitForSize(s.width, s.height)
        return {
          layers: nextLayers,
          activeLayerId: nextActiveId,
          past: appendPast(s.past, s, limit),
          future: []
        }
      })
    },

    selectLayer: (id) => set({ activeLayerId: id }),

    toggleLayerVisibility: (id) => {
      set((s) => ({
        layers: s.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
      }))
    },

    toggleLayerLock: (id) => {
      set((s) => ({
        layers: s.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l)
      }))
    },

    setLayerName: (id, name) => {
       set((s) => {
        const limit = historyLimitForSize(s.width, s.height)
        return {
          layers: s.layers.map(l => l.id === id ? { ...l, name } : l),
          past: appendPast(s.past, s, limit),
          future: []
        }
       })
    },

    undo: () =>
      set((s) => {
        const last = s.past[s.past.length - 1]
        if (!last) return s
        const limit = historyLimitForSize(s.width, s.height)
        return {
          ...s,
          past: s.past.slice(0, -1),
          future: prependFuture(s.future, s, limit),
          layers: cloneLayers(last.layers),
          activeLayerId: last.activeLayerId,
          width: last.width,
          height: last.height
        }
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0]
        if (!next) return s
        const limit = historyLimitForSize(s.width, s.height)
        return {
          ...s,
          past: appendPast(s.past, s, limit),
          future: s.future.slice(1),
          layers: cloneLayers(next.layers),
          activeLayerId: next.activeLayerId,
          width: next.width,
          height: next.height
        }
      })
  }
})
