import { create } from 'zustand'

export type TextBuffer = {
  width: number
  height: number
  lines: string[]
}

export type Cursor = { row: number; col: number } | null

type HistoryEntry = TextBuffer

export type EditorState = {
  buffer: TextBuffer
  cursor: Cursor
  past: HistoryEntry[]
  future: HistoryEntry[]
  setCursor: (cursor: Cursor) => void
  newBuffer: (width: number, height: number) => void
  setBufferFromText: (text: string) => void
  undo: () => void
  redo: () => void
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

function normalizeTextToBuffer(text: string, width: number, height: number): TextBuffer {
  const normalized = text.replace(/\r\n/g, '\n')
  const rawLines = normalized.split('\n')

  const lines: string[] = []
  for (let i = 0; i < height; i += 1) {
    const src = rawLines[i] ?? ''
    lines.push(src.slice(0, width))
  }

  return { width, height, lines }
}

export function bufferToText(buffer: TextBuffer, opts?: { padRight?: boolean }) {
  const padRight = opts?.padRight ?? false
  const out: string[] = []
  for (let i = 0; i < buffer.height; i += 1) {
    const line = buffer.lines[i] ?? ''
    out.push(padRight ? line.padEnd(buffer.width, ' ') : line)
  }
  return out.join('\n')
}

function cloneBuffer(b: TextBuffer): TextBuffer {
  return { width: b.width, height: b.height, lines: [...b.lines] }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  buffer: { width: 80, height: 24, lines: Array.from({ length: 24 }, () => '') },
  cursor: null,
  past: [],
  future: [],
  setCursor: (cursor) => set({ cursor }),
  newBuffer: (width, height) => {
    const w = clampInt(width, 1, 2000)
    const h = clampInt(height, 1, 2000)
    const next: TextBuffer = { width: w, height: h, lines: Array.from({ length: h }, () => '') }
    set((s) => ({ ...s, past: [...s.past, cloneBuffer(s.buffer)], future: [], buffer: next, cursor: null }))
  },
  setBufferFromText: (text) => {
    const { buffer } = get()
    const next = normalizeTextToBuffer(text, buffer.width, buffer.height)
    set((s) => ({ ...s, past: [...s.past, cloneBuffer(s.buffer)], future: [], buffer: next }))
  },
  undo: () =>
    set((s) => {
      const last = s.past[s.past.length - 1]
      if (!last) return s
      return {
        ...s,
        past: s.past.slice(0, -1),
        future: [cloneBuffer(s.buffer), ...s.future],
        buffer: cloneBuffer(last)
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      return {
        ...s,
        past: [...s.past, cloneBuffer(s.buffer)],
        future: s.future.slice(1),
        buffer: cloneBuffer(next)
      }
    })
}))
